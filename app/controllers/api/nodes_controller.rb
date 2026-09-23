require 'json'

module Api
  class NodesController < ApplicationController
    def show
      node = Rails.cache.fetch("#{params[:cluster]}node_#{params[:name]}", expires_in: 30.seconds,
                                                                           race_condition_ttl: 3.seconds) do
        # Get detailed node info including state, memory, GPU
        output, status = Open3.capture2e("scontrol --cluster=#{params[:cluster]} show node -a --oneliner -d #{params[:name]}")

        raise "Failed to fetch node status: #{output}" unless status.success?

        result = Util.scontrol_to_hash(output)
        node_data = result.find { |node| node['NodeName'] == params[:name] }

        raise 'Node not found' unless node_data

        alloctres_hash = node_data['AllocTRES'].split(',').map { |pair| pair.split('=', 2) }.to_h
        cfgtres_hash = node_data['CfgTRES'].split(',').map { |pair| pair.split('=', 2) }.to_h
        node_data['gpu_info'] = {
          'allocated' => (alloctres_hash['gres/gpu'] || 0).to_i,
          'total' => (cfgtres_hash['gres/gpu'] || 0).to_i,
          'model' => node_data['Gres'].split(':')[1]
        }

        # Get jobs running on this node
        jobs_output, jobs_status = Open3.capture2e("squeue --cluster=#{params[:cluster]} --nodelist=#{params[:name]} --states=all --json | tail -n+2")

        Rails.logger.error "Failed to fetch jobs: #{jobs_output}" unless jobs_status.success?

        node_data['job_info'] = JSON.parse(jobs_output)
        # node_data['job_info'] = jobs_output
        node_data
      end

      render json: node
    rescue StandardError => e
      status_code = e.message.include?('Node not found') ? :not_found : :internal_server_error
      render json: { error: e.message }, status: status_code
    end
  end
end
