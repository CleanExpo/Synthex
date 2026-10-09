const denied = () => {
  throw new Error('SYN-1113: network disabled');
};
globalThis.fetch = denied;
for (const name of ['node:http', 'node:https']) {
  const module = require(name);
  module.request = denied;
  module.get = denied;
}
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const address = args[0];
  if (typeof address === 'string' && address.startsWith('/'))
    return connect.apply(this, args);
  if (
    address &&
    typeof address === 'object' &&
    typeof address.path === 'string'
  )
    return connect.apply(this, args);
  return denied();
};
