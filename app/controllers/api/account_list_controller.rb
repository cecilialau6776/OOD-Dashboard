require 'net/http'
require 'json'

PROJECTS_ENDPOINT = URI('https://coldfront.rc.rit.edu/api/projects/').freeze

module Api
  class AccountListController < ApplicationController
    def get
      user = @user.name
      myaccounts = Rails.cache.fetch("myaccounts/#{user}", expires_in: 1.minutes, race_condition_ttl: 3.seconds) do
        myaccounts_str, exit_code = Open3.capture2("OUT_FMT=json /tools/bin/my-accounts #{user}")

        return false unless exit_code.success?

        myaccounts_json = JSON.parse(myaccounts_str)
        myaccounts_json
      end

      return head :internal_server_error unless myaccounts

      projects = Rails.cache.fetch("cf_projects/#{user}", expires_in: 1.minutes, race_condition_ttl: 3.seconds) do
        headers = { Accept: 'application/json', Authorization: "Token #{::Configuration.coldfront_api_key}" }
        res_str = Net::HTTP.get(PROJECTS_ENDPOINT, headers)
        projects = JSON.parse(res_str)
        projects
      end

      if projects
        myaccounts.map do |account|
          project = projects.find { |project| project["title"] == account["name"] }
          account["project_id"] = project["id"]
        end
      end

      render json: myaccounts, status: :ok
    end
  end
end
