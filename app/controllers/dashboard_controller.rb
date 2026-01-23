# The controller for dashboard (root) pages /dashboard
class DashboardController < ApplicationController
  include MotdConcern
  
  def index
    begin
      set_motd
    rescue StandardError => e
      flash.now[:alert] = t('dashboard.motd_erb_render_error', error_message: e.message)
    end
    set_maintenance
    set_my_quotas
  end

  def logout
  end

  def set_maintenance
    @maintenance = Rails.cache.fetch("next_maintenance", expires_in: 1.hours, race_condition_ttl: 5.seconds) do
      next_maintenance, exit_code = Open3.capture2("/tools/bin/time-until-maintenance | sed '3q;d'")

      if !exit_code.success?
        return "Error running time-until-maintenance"
      end

      next_maintenance
    end
  end

end
