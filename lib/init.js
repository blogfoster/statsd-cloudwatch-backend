import _ from 'underscore';
import AWS from 'aws-sdk';
import Fmt from 'fmt';

import { Backend } from './backend';

function startup(config, time, emitter, logger) {
  const backend = new Backend(config, time, logger);
  emitter.on('flush', ::backend.flush);
  emitter.on('status', ::backend.status);
}

export function init(startupTime, config, emitter, logger) {
  config = _.defaults(config.cloudwatch || {}, {
    debug: config.debug,
    dumpMessages: config.dumpMessages,
    dimensions: {}
  });

  if (!config.namespace) {
    logger.log('cloudwatch config is missing "namespace"');
    return false;
  }
  if (!config.region) {
    logger.log('cloudwatch config is missing "region"');
    return false;
  }

  AWS.config.update(config);
  AWS.config.apiVersions = {
    cloudwatch: '2010-08-01'
  };

  // load some meta data information
  const metadataServce = new AWS.MetadataService({ httpOptions: { timeout: 10000 } });
  const metadata = {};
  logger.log('cloudwatch - requesting the metadata api');
  metadataServce.request('/latest/meta-data/instance-id', (err, data) => {
    if (err) {
      if (config.debug) {
        logger.log(`cloudwatch backend could not access meta-data service: ${err.code}`);
      }

      if (config.dumpMessages) {
        Fmt.dump(err);
      }
    } else {
      metadata.InstanceId = data;
    }

    // update dimensions with meta data information
    Object.keys(config.dimensions).forEach((key) => {
      const val = config.dimensions[key];
      config.dimensions[key] = _.template(val)(metadata);
    });

    startup(config, startupTime, emitter, logger);
  });

  return true;
}
