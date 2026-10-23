// config/api_params.js

const PROVIDER_ACTIONS = {
  GET_BALANCE: 'getBalance',
  GET_NUMBER: 'getNumber',
  GET_STATUS: 'getStatus',
  SET_STATUS: 'setStatus',
  GET_COUNTRIES: 'getCountries',
  GET_SERVICES_LIST: 'getServicesList',
  GET_OPERATORS: 'getOperators',
  GET_PRICES: 'getPrices'
};

function buildApiUrl(baseUrl, apiKey, action, extraParams = {}) {
  const url = new URL(baseUrl);
  
  url.searchParams.append('api_key', apiKey);
  url.searchParams.append('action', action);

  for (const key in extraParams) {
    if (extraParams[key] !== undefined && extraParams[key] !== '') {
      url.searchParams.append(key, extraParams[key]);
    }
  }

  return url.toString();
}

module.exports = {
  PROVIDER_ACTIONS,
  buildApiUrl
};
