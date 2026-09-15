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

  def logout; end

  def set_maintenance
    maintenance_times = Rails.cache.fetch('next_maintenance', expires_in: 1.hours, race_condition_ttl: 5.seconds) do
      err_output = { error: 'Error running getting next maintenance window' }
      begin
        next_maintenance_json, exit_code = Open3.capture2(%q[scontrol show reservations --json | jq '[ .reservations[] | select((.flags | index("MAINT"))) ] | min_by(.start_time.number)'])
        return err_output unless exit_code.success?

        next_maintenance_json = JSON.parse(next_maintenance_json)
      rescue JSON::ParserError
        return err_output
      end
      start_time = Time.at(next_maintenance_json['start_time']['number'])
      end_time = Time.at(next_maintenance_json['end_time']['number'])
      { start: start_time, end: end_time }
    end

    if maintenance_times[:error]
      Rails.cache.delete('next_maintenance')
      return maintenance_times[:error]
    end

    now = Time.now
    if now < start_time
      "Next maintenance window on #{maintenance_times[:start].strftime('%b %-d, %Y at %-I:%M %p')}"
    else
      "Cluster currently under maintenance. Should end by #{maintenance_times[:end].strftime('%-I:%M %p on %b %-d, %Y')}"
    end
  end
end
