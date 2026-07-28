require 'uri'
require 'icalendar'
require 'net/http'
require 'json'

module Api
  class NewsFeedController < ApplicationController
    def get
      uri = URI('https://calendar.google.com/calendar/ical/rit.rc.events%40gmail.com/public/basic.ics')
      res = Net::HTTP.get_response(uri)

      return head :internal_server_error unless res.is_a?(Net::HTTPSuccess)

      ical_str = res.body
      cals = Icalendar::Calendar.parse(ical_str)
      cal = cals.first
      events = cal.events

      return head :internal_server_error unless events

      now = Time.now.getutc
      in_a_month = now + 30.days

      # return render json: {now: now, later: in_a_month}.to_json, status: :ok
      upcoming_occurrences = events.reject { |event| event.rrule.empty? }
                                   .map { |event| event.occurrences_between(now, in_a_month) }
                                   .flatten
      upcoming_events = upcoming_occurrences.map do |occurrence|
        {
          dtstart: occurrence.start_time,
          dtend: occurrence.end_time,
          description: occurrence.parent.description,
          summary: occurrence.parent.summary
        }
      end
      upcoming_events += events.filter { |event| event.dtend > now && event.dtstart < in_a_month }
                               .map do |event|
        dtstart = event.dtstart
        dtend = event.dtend
        {
          dtstart: dtstart,
          dtend: dtend,
          description: event.description,
          summary: event.summary
        }
      end
      upcoming_events.sort! { |a, b| a[:dtstart] <=> b[:dtstart] }

      render json: upcoming_events.to_json, status: :ok
      # render json: upcoming_events.first(3).to_json, status: :ok
    end
  end
end
