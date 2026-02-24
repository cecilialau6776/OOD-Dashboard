module Api
  class AccountListController < ApplicationController
    def get
      user = @user.name
      myaccounts = Rails.cache.fetch("account_list/#{user}", expires_in: 1.minutes, race_condition_ttl: 3.seconds) do
        myaccounts_json, exit_code = Open3.capture2("OUT_FMT=json /tools/bin/my-accounts #{user}")

        return false unless exit_code.success?

        myaccounts_json
      end

      if myaccounts
        render json: myaccounts, status: :ok
      else
        head :internal_server_error
      end
    end
  end
end
