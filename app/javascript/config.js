'use strict';

const CONFIG_ID = 'ood_config'

export function pageConfigData() {
  return document.getElementById("page-data").dataset;
}

export function configData() {
  return document.getElementById(CONFIG_ID).dataset;
}

export function maxFileSize () {
  const cfgData = configData();

  // Check if cfgData['maxFileSize'] is just empty string, 
  // if so set default of maxFileUpload=10737420000 bytes.
  if (cfgData['maxFileSize'].length == 0) {
    return parseInt(10737420000, 10);
  }
  else {
    const maxFileSize = cfgData['maxFileSize'];
    return parseInt(maxFileSize, 10);
  }
}

export function transfersPath() {
  const cfgData = configData();
  const transfersPath = cfgData['transfersPath'];

  return transfersPath;
}

export function rootPath(){
  const cfgData = configData();
  const rootPath = cfgData['rootPath'];
  if(rootPath == '/') {
    return rootPath;
  } else {
    // remove the trailing / from /pun/sys/dashboard/
    return rootPath.substring(0, rootPath.length-1)
  }
}

export function csrfToken() {
  const csrf_token = document.querySelector('meta[name="csrf-token"]').content;

  return csrf_token;
}

export function uppyLocale() {
  const cfgData = configData();
  return JSON.parse(cfgData['uppyLocale']);
}

export function isBCDynamicJSEnabled() {
  const cfgData = configData();
  return cfgData['bcDynamicJs'] == 'true'
}

export function downloadEnabled() {
  const cfgData = configData();
  return cfgData['downloadEnabled'] == 'true';
}

/*
  Will return null if xdmod integration is not enabled.
*/
export function xdmodUrl(){
  const cfgData = configData();
  const url = cfgData['xdmodUrl'];
  return url == "" ? null : url;
}

export function analyticsPath(type){
  const cfgData = configData();
  const basePath = cfgData['baseAnalyticsPath']
  return `${basePath}/${type}`;
}

export function bcPollDelay() {
  const cfgData = configData();
  return Number(cfgData['bcPollDelay']);
}

export function bcIndexUrl() {
  const cfgData = configData();
  return cfgData['bcIndexUrl'];
}

export function statusPollDelay() {
  const cfgData = configData();
  return Number(cfgData['statusPollDelay']);
}

export function statusIndexUrl() {
  const cfgData = configData();
  return cfgData['statusIndexUrl'];
}

export function supportPath() {
  const cfgData = configData();
  const supportPath = cfgData['supportPath'];

  return supportPath;
}

export function appsDatatablePageLength() {
  const cfgData = configData();
  return parseInt(cfgData['appsDatatablePageLength']);
}

export function userHome() {
  const cfgData = configData();
  return cfgData['userHome'];
}

// homepage widget URLs
export function newsFeedUrl() {
  const cfgData = configData();
  return cfgData['newsFeedUrl'];
}

export function jobQueueUrl() {
  const cfgData = configData();
  return cfgData['jobQueueUrl'];
}

export function jobPathUrl(id="JOB_ID") {
  const cfgData = configData();
  return cfgData['jobPathUrl'].replace('JOB_ID', id);
}

export function jobApiPathUrl(id="JOB_ID") {
  const cfgData = configData();
  return cfgData['jobApiPathUrl'].replace('JOB_ID', id);
}

export function clusterStatusUrl() {
  const cfgData = configData();
  return cfgData['clusterStatusUrl'];
}

export function gpuHourSummaryUrl() {
  const cfgData = configData();
  return cfgData['gpuHourSummaryUrl'];
}

export function accountListUrl() {
  const cfgData = configData();
  return cfgData['accountListUrl'];
}

export function filesPath() {
  const cfgData = configData();
  return cfgData['filesPath'];
}

export function cancelJobsPath() {
  const cfgData = configData();
  return cfgData['cancelJobsPath'];
}

export function cancelJobApiPath(id="JOB_ID") {
  const cfgData = configData();
  return cfgData['cancelJobApiPath'].replace('JOB_ID', id);
}

export function username() {
  const cfgData = configData();
  return cfgData['username'];
}

export function performanceMetricsUrl() {
  const cfgData = configData();
  return cfgData['performanceMetricsUrl'];
}

export function performanceMetricsApiUserdataUrl() {
  const cfgData = configData();
  return cfgData['performanceMetricsApiUserdataUrl'];
}

export function performanceMetricsApiSacctuserUrl() {
  const cfgData = configData();
  return cfgData['performanceMetricsApiSacctuserUrl'];
}

export function nodePathUrl(id="NODE_ID") {
  const cfgData = configData();
  return cfgData['nodePathUrl'].replace('NODE_ID', id);
}
