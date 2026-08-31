require 'json'
require 'open3'

class JobInfoController < ApplicationController
  def json
    cluster = params[:cluster]
    jobid = params[:jobid]

    # Validate job ID format
    return render json: { error: 'Invalid job ID format.' }, status: :bad_request unless /^\d+(_\d+)?$/.match?(jobid)

    # Cache jobinfo results for jobs that have an exit code
    # because their info won't change anymore, unlike
    # running or pending jobs, which may change wall time,
    # CPU usage, etc. over time
    cache_key = "job_info/#{cluster}/#{jobid}"
    cached_result = Rails.cache.read(cache_key)

    if cached_result.present? && cached_result['End Time'] == 'N/A'
      return render json: cached_result.to_json, status: :ok
    end

    squeue = Rails.cache.fetch("squeue/#{cluster}", expires_in: 1.seconds) do
      output, status = Open3.capture2("squeue -M #{cluster} -t all -h -o '%i|%P|%j|%u|%T|%r'")

      return [] unless status.success?

      jobs = output.split("\n").map do |job|
        s = job.split('|')
        {
          jobid: s[0],
          partition: s[1],
          name: s[2],
          user: s[3],
          state: s[4],
          reason: s[5]
        }
      end
      jobs
    end

    result, status = Open3.capture2("sacct -M #{cluster} -j #{jobid} -P -n -o #{MyJobsController::SACCT_FIELDS.join(',')}")

    return render json: { error: 'sacct command failed' }, status: :internal_server_error unless status.success?

    interactive_app_regex = %r{\A/home/#{Regexp.escape(@user.name)}/ondemand/data/sys/dashboard/batch_connect/sys/\w+/output/(?<uuid>[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\z}
    jobs = {}

    result.each_line do |line|
      s = line.strip.split('|', -1)
      job_cluster = s[0]
      job_id = s[1].split('.')[0]
      job_key = "#{job_cluster}-#{job_id}"

      if !jobs.key?(job_key)
        jobs[job_key] = MyJobsController::FIELDS.keys.map do |field|
          [field, '']
        end.to_h.merge(MyJobsController::SACCT_FIELDS.zip(s).to_h)
        match_interactive_app = jobs[job_key]['workdir'].match(interactive_app_regex)
        jobs[job_key]['sessionid'] = match_interactive_app ? match_interactive_app['uuid'] : 'N/A'
      else
        MyJobsController::PREFER_MAX_FIELDS.each do |field|
          jobs[job_key][field] = [jobs[job_key][field], s[MyJobsController::SACCT_FIELDS.index(field)]].max_by do |val|
            MyJobsController::FIELDS[field]['compare_fn'].call(val)
          end
        end
      end
    end

    result_hash = jobs.values.map do |j|
      [MyJobsController::SIZE_FIELDS, MyJobsController::DURATION_FIELDS,
       MyJobsController::TIMESTAMP_FIELDS].flatten.each do |field|
        j[field] = MyJobsController::FIELDS[field]['compare_fn'].call(j[field])
      end

      state_match = j['state'].match(/^CANCELLED by (\d+)$/)
      unless state_match.nil?
        username = Rails.cache.fetch("user_id/#{state_match.captures[0]}") do
          `id -un #{state_match.captures[0]}`
        end

        j['state'] = "CANCELLED by #{username}" if $?.success?
      end

      j['reason'] = squeue.find do |job|
        job[:jobid] == j['jobid'] && job[:state] == j['state']
      end&.[](:reason) || j['reason']

      j['timeeff'] = "#{(j['elapsed'].to_f * 100 / j['timelimit'].to_f).round(2)}%"
      j['timeeff'] = '--' if j['timeeff'] == 'NaN%'
      j['cpueff'] = "#{(j['totalcpu'].to_f * 100 / (j['alloccpus'].to_f * j['elapsed'].to_f)).round(2)}%"
      j['cpueff'] = '--' if j['cpueff'] == 'NaN%'
      j['memeff'] = "#{(j['maxrss'].to_f * 100 / j['reqmem'].to_f).round(2)}%"
      j['memeff'] = '--' if j['memeff'] == 'NaN%'

      j['used_gpu_hours'], j['required_gpu_hours'] = Util.get_gpu_hours_usage(j['jobid'], j['partition'], j['qos'],
                                                                              j['elapsed'], j['timelimit'], j['reqtres'])

      j['reqtres'] = j['reqtres'].split(',').map do |pair|
        key, value = pair.split('=')
        [key, key == 'mem' ? Util.to_bytes(value).to_i : value.to_i]
      end.to_h.map do |key, val|
        "#{key}: #{val}"
      end.join(', ')

      j['nodelist'] = expand_nodelist(j['nodelist'])

      if j['state'] == 'REQUEUED'
        output, status = Open3.capture2("scontrol -M #{cluster} show job #{j['jobid']} -o")
        if status.success?
          output_hash = Util.scontrol_to_hash(output)[0]
          j['requeue_count'] = output_hash['Restarts']
        else
          j.delete('requeue_count')
        end
      else
        j.delete('requeue_count')
      end

      j['start'] = j['start'] != 'N/A' ? "#{Time.at(j['start']).utc.strftime('%F %T')} UTC" : 'N/A'
      j['end'] = j['end'] != 'N/A' ? "#{Time.at(j['end']).utc.strftime('%F %T')} UTC" : 'N/A'
      j['submit'] = j['submit'] != 'N/A' ? "#{Time.at(j['submit']).utc.strftime('%F %T')} UTC" : 'N/A'
      j.delete('planned')

      j['elapsed'] = Util.seconds_to_timestr(j['elapsed'])
      j['timelimit'] = Util.seconds_to_timestr(j['timelimit'])

      j['reqmem'] = Util.from_bytes(j['reqmem'])
      j['maxrss'] = Util.from_bytes(j['maxrss'])
      j['maxdiskwrite'] = Util.from_bytes(j['maxdiskwrite'])
      j['maxdiskread'] = Util.from_bytes(j['maxdiskread'])

      j.delete('sessionid') if j['sessionid'] == 'N/A'

      j.delete('timestamp')

      # TODO: They currently just show either blank or cpucpucpucpu...
      j.delete('used_su')
      j.delete('required_su')

      j
    end

    result_hash = result_hash[0]
    result_hash = result_hash.transform_keys do |field|
      f = MyJobsController::FIELDS[field]
      f && f['formattedname'] ? f['formattedname'] : field
    end
    Rails.cache.write(cache_key, result_hash)

    if result_hash
      render json: result_hash.to_json, status: :ok
    else
      head :internal_server_error
    end
  end

  private

  def expand_nodelist(value)
    return 'N/A' if value.nil? || value == '(null)' || value == 'None' || value == 'N/A'

    nodes = []
    # Match patterns like: a[859,861-869,871-888,890-891,893,895-898,901-902,905,907,910]
    if match = value.match(/^([a-zA-Z]+)\[([\d\-,]+)\]$/)
      prefix = match[1]
      ranges = match[2].split(',')

      ranges.each do |range|
        if range.include?('-')
          start, finish = range.split('-').map(&:to_i)
          (start..finish).each { |n| nodes << "#{prefix}#{n}" }
        else
          nodes << "#{prefix}#{range}"
        end
      end
    else
      # Handle single node case or comma-separated nodes without ranges
      nodes = value.split(',')
    end

    nodes.join(',')
  end
end
