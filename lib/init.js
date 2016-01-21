var AWS  = require('aws-sdk'),
    fmt = require('fmt'),
    util = require('util'),
    _    = require('underscore')

var backend = require('./backend')

exports.init = function(startupTime, config, emitter, logger) {
  config = _.defaults(config.cloudwatch || {}, {
    debug: config.debug,
    dumpMessages: config.dumpMessages,
    dimensions: {}
  })

  if (!config.namespace) {
    logger.log('cloudwatch config is missing "namespace"')
    return false
  }
  if (!config.region) {
    logger.log('cloudwatch config is missing "region"')
    return false
  }

  AWS.config.update(config)
  AWS.config.apiVersions = {
    cloudwatch: '2010-08-01',
  }

  // load some meta data information
  var metadataServce = new AWS.MetadataService()
  var metadata = {};
  metadataServce.request('/latest/meta-data/instance-id', function(err, data) {
    if (err) {
      if (config.debug)
        logger.log('cloudwatch backend could not access meta-data service: ' + err.code)

      if (config.dumpMessages)
        fmt.dump(err)

      return
    }
    metadata.InstanceId = data

    // update dimensions with meta data information
    Object.keys(config.dimensions).forEach(function (key) {
      var val = config.dimensions[key];
      config.dimensions[key] = _.template(val)(metadata)
    })

    startup(config, startupTime, emitter, logger)
  });

  return true
}

function startup(config, time, emitter, logger) {
  new backend.Backend(config, time, function(flush, status) {
    if (flush) emitter.on('flush', flush)
    if (status) emitter.on('status', status)
  }, logger)
}
