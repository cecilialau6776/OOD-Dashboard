module Api
  class JobQueueController < ApplicationController
    def get
      squeue = Rails.cache.fetch('squeue', expires_in: 5.seconds) do
        output, status = Open3.capture2e('squeue --clusters=all --me --json')

        raise "Failed to fetch job queue status: #{output}" unless status.success?

        clusters_info = output.split(/CLUSTER: [^\n]+/).reject { |element| element == '' }
        jobs = clusters_info.map { |info_str| JSON.parse(info_str.strip)['jobs'] }.reduce(:+)
        jobs
      end

      return head :internal_server_error unless squeue

      render json: squeue.to_json, status: :ok
    end
  end
end
