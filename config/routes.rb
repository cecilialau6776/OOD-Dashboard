# frozen_string_literal: true

require 'authz/app_developer_constraint'

Rails.application.routes.draw do
  if Configuration.can_access_projects?
    get 'projects/possible_imports' => 'projects#possible_imports', :as => 'project_possible_imports'
    post 'projects/import' => 'projects#import_save', :as => 'project_import_save'

    resources :projects do
      root 'projects#index'
      get '/jobs/:cluster/:jobid' => 'projects#job_details', :defaults => { :format => 'turbo_stream' }, :as => 'job_details'
      delete '/jobs/:cluster/:jobid' => 'projects#delete_job', :as => 'delete_job'
      post '/jobs/:cluster/:jobid/stop' => 'projects#stop_job', :as => 'stop_job'
      
      # These routes are unused but prevent errors
      get 'workflows', to: 'projects#show', on: :member
      get 'launchers', to: 'projects#show', on: :member
      
      resources :workflows do
        member do
          post 'submit'
          post 'save'
          get 'load'
          get 'clone'
        end
      end

      resources :launchers do
        post 'submit', on: :member
        post 'save', on: :member
        get 'render_button', on: :member
        get 'clone', on: :member
      end
    end
  end

  # in production, if the user doesn't have access to the files app directory, we hide the routes
  if Configuration.can_access_files?
    constraints(->(request) { request.params[:fs].to_s.match?(%r{^(?!(edit|api))[^/]+$}) }) do
      get 'files/:fs(/*filepath)' => 'files#fs', :defaults => { :fs => 'fs', :format => 'html' }, :format => false,
          :as => :files
      put 'files/:fs/*filepath' => 'files#update', :format => false, :defaults => { :fs => 'fs', :format => 'json' }

      # TODO: deprecate these routes after updating OodAppkit to use the new routes above
      # backwards compatibility with the "api" routes that OodAppkit provides
      # and are used by File Editor and Job Composer
      get 'files/api/v1/:fs(/*filepath)' => 'files#fs', :defaults => { :fs => 'fs', :format => 'html' },
          :format => false
      put 'files/api/v1/:fs/*filepath' => 'files#update', :format => false,
          :defaults => { :fs => 'fs', :format => 'json' }
    end
    post 'files/upload/:fs' => 'files#upload', :defaults => { :fs => 'fs' } if Configuration.upload_enabled?

    get 'files', to: redirect("files/fs#{Dir.home}")
    get 'files/fs', to: redirect("files/fs#{Dir.home}")
    get 'frames/directory_frame' => 'files#directory_frame', as: 'directory_frame'
    resources :transfers, only: [:show, :create, :destroy]
  end

  if Configuration.can_access_file_editor?
    # App file editor
    get 'files/edit/:fs/*filepath' => 'files#edit', :defaults => { :fs => 'fs', :path => '/', :format => 'html' },
        :format => false
    get 'files/edit/:fs' => 'files#edit', :defaults => { :fs => 'fs', :path => '/', :format => 'html' },
        :format => false
  end

  namespace :batch_connect do
    resources :sessions, only: [:index, :destroy]
    post 'sessions/:id/cancel', to: 'sessions#cancel', as: 'cancel_session'
    scope '*token', constraints: { token: %r{((usr/[^/]+)|dev|sys)/[^/]+(/[^/]+)?} } do
      resources :settings, only: [:show, :destroy]
      resources :session_contexts, only: [:new, :create]
      get "session_contexts/edit_settings/:id", to: "session_contexts#edit_settings", as: 'edit_settings'
      post "session_contexts/save_settings", to: "session_contexts#save_settings", as: 'save_settings'

      root 'session_contexts#new'
    end
  end
  get 'errors/not_found'
  get 'errors/internal_server_error'
  get 'dashboard/index'
  get 'logout' => 'dashboard#logout'

  # analytics request appears in the access logs and google analytics
  get 'analytics/:type' => proc { [204, {}, ['']] }, :as => 'analytics'

  get 'apps/show/:name(/:type(/:owner))' => 'apps#show', :as => 'app', :defaults => { type: 'sys' }, :constraints => { owner: %r{[^/]+} }
  get 'apps/icon/:name(/:type(/:owner))' => 'apps#icon', :as => 'app_icon', :defaults => { type: 'sys' }, :constraints => { owner: %r{[^/]+} }
  get 'apps/index' => 'apps#index'

  get 'apps/restart' => 'apps#restart' if Configuration.app_sharing_enabled?

  root 'dashboard#index'

  # API endpoints
  get "api/balance_usage", action: :get, controller: "api/balance_usage", as: "balance_usage"
  get "api/account_list", action: :get, controller: "api/account_list", as: "account_list"
  get "api/disk_usage", action: :get, controller: "api/disk_usage", as: "disk_usage"
  get "api/partition_status", action: :get, controller: "api/partition_status", as: "partition_status"
  get "api/news_feed", action: :get, controller: "api/news_feed", as: "news_feed"
  get "api/job_queue", action: :get, controller: "api/job_queue", as: "job_queue"
  get "api/balance_summary", action: :get, controller: "api/balance_summary", as: "balance_summary"
  get "api/gpu_hour_summary", action: :get, controller: "api/gpu_hour_summary", as: "gpu_hour_summary"
  get "api/cluster_status", action: :get, controller: "api/cluster_status", as: "cluster_status_api"
  get "api/nodes/:name", action: :show, controller: "api/nodes", as: "node_api"
  get "api/jobs/:jobid", action: :show, controller: "api/jobs", as: "job_api"
  delete "api/jobs/:jobid/cancel", action: :cancel, controller: "api/jobs", as: "cancel_job_api"

  get "api/userdata", action: :getuserdata, controller: "api/performance_metrics"
  get "api/sacctuser", action: :getsacctuser, controller: "api/performance_metrics"

  # App administration
  scope 'admin/:type', constraints: Authz::AppDeveloperConstraint do
    resources :products, except: :destroy, param: :name, constraints: { type: /dev|usr/ } do
      nested do
        scope ':context' do
          resources :permissions, only: [:index, :new, :create, :destroy], param: :name
        end
      end
      member do
        patch 'cli/:cmd', to: 'products#cli', as: 'cli'
      end
      collection do
        get 'create_key'
        get 'new_from_git_remote'
        post 'create_from_git_remote'
      end
    end
  end

  # ActiveJobs which can be disabled in production
  if Configuration.can_access_activejobs?
    get '/activejobs' => 'active_jobs#index', :as => 'active_jobs'
    get '/activejobs/json' => 'active_jobs#json', :defaults => { :format => 'json' }
    delete '/activejobs' => 'active_jobs#delete_job', :as => 'delete_job'
  end

  get '/system-status', to: 'system_status#index', as: 'system_status' if Configuration.can_access_system_status?

  post 'settings', :to => 'settings#update'

  # Experimental Feature
  # Allows widget partials to be rendered without any page furniture.
  # It can be use to extend OOD functionality.
  if Configuration.widget_partials_enabled?
    match '/widgets/*widget_path', to: 'widgets#show', via: [:get, :post], as: 'widgets'
  end

  # Support ticket routes
  if Configuration.support_ticket_enabled?
    get '/support', to: 'support_ticket#new'
    post '/support', to: 'support_ticket#create'
  end

  # Custom pages route
  get '/custom/:page_code', to: 'custom_pages#index', as: :custom_pages

  match '/404', :to => 'errors#not_found', :via => :all
  match '/500', :to => 'errors#internal_server_error', :via => :all

  get 'module-browser' => 'module_browser#index', :as => 'module_browser'
  get "/performance_metrics" => "performance_metrics#index", as: "performance_metrics"
  get "/cluster_status" => "cluster_status#index", as: "cluster_status"
  get "/nodes/:name" => "nodes#show", as: "node"
  get "/job/:jobid" => "job#show", as: "job"

  get "/myjobs" => "my_jobs#index", as: "my_jobs"
  get "/myjobs/json" => "my_jobs#json"
  delete "/myjobs" => "my_jobs#cancel_jobs", as: "cancel_jobs"

  get "/job/:jobid/json" => "job_info#json"

  get '/jobs/info/:cluster/:id' => 'jobs#info', :defaults => { :format => 'json' }, :as => 'jobs_info'

  # The priority is based upon order of creation: first created -> highest priority.
  # See how all your routes lay out with "rake routes".

  # You can have the root of your site routed with "root"
  # root 'welcome#index'

  # Example of regular route:
  #   get 'products/:id' => 'catalog#view'

  # Example of named route that can be invoked with purchase_url(id: product.id)
  #   get 'products/:id/purchase' => 'catalog#purchase', as: :purchase

  # Example resource route (maps HTTP verbs to controller actions automatically):
  #   resources :products

  # Example resource route with options:
  #   resources :products do
  #     member do
  #       get 'short'
  #       post 'toggle'
  #     end
  #
  #     collection do
  #       get 'sold'
  #     end
  #   end

  # Example resource route with sub-resources:
  #   resources :products do
  #     resources :comments, :sales
  #     resource :seller
  #   end

  # Example resource route with more complex sub-resources:
  #   resources :products do
  #     resources :comments
  #     resources :sales do
  #       get 'recent', on: :collection
  #     end
  #   end

  # Example resource route with concerns:
  #   concern :toggleable do
  #     post 'toggle'
  #   end
  #   resources :posts, concerns: :toggleable
  #   resources :photos, concerns: :toggleable

  # Example resource route within a namespace:
  #   namespace :admin do
  #     # Directs /admin/products/* to Admin::ProductsController
  #     # (app/controllers/admin/products_controller.rb)
  #     resources :products
  #   end

  get '/help/dashboard-guide', to: 'help#dashboard_guide'
end
