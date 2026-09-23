class NodesController < ApplicationController
  def show
    @node_name = params[:name]
    @cluster = params[:cluster]
  end
end
