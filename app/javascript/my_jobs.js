'use strict';

import moment from 'moment-timezone';
import daterangepicker from 'daterangepicker';
import toastr from 'toastr';

import { csrfToken } from './config.js';

window.moment = moment;
window.daterangepicker = daterangepicker;
window.csrf_token = csrfToken;
window.toastr = toastr;
