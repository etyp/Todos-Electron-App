var appUrl = 'http://localhost:3000';

var ddpOptions = {
  autoReconnect: false,
  autoReconnectTimer: 500,
  maintainCollections: true,
  ddpVersion: '1',
  host: 'localhost',
  useSockJs: true,
  port: 3000
};

module.exports = {
  ddpOptions: ddpOptions,
  appUrl: appUrl
};
