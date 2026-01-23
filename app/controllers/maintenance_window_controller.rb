class MaintenanceWindowController < ApplicationController
  def get
    next_maintenance_text = Rails.cache.fetch("next_maintenance", expires_in: 1.weeks, race_condition_ttl: 5.seconds) do
      next_maintenance, exit_code = Open3.capture2("time-until-maintenance | sed '3q;d'")

      if !exit_code.success?
        return false
      end

      next_maintenance
    end

    if next_maintenance_text
      render text: next_maintenance_text, status: :ok
    else
      head :internal_server_error
    end
  end
end
