import _ from 'underscore';
import AWS from 'aws-sdk';
import Fmt from 'fmt';

function collectTimers(date, timers, dimensions) {
  return Object.keys(timers).map((key) => {
    const data = timers[key].length ? timers[key] : [0];

    const values = {
      Minimum: Math.min.apply(null, data),
      Maximum: Math.max.apply(null, data),
      Sum: data.reduce((memo, num) => memo + num, 0),
      SampleCount: data.length
    };

    return {
      MetricName: key,
      StatisticValues: values,
      Unit: 'Milliseconds',
      Timestamp: date,
      Dimensions: dimensions
    };
  });
}

function collectCounters(date, counters, dimensions) {
  return Object.keys(counters).map((key) => {
    return {
      MetricName: key,
      Value: counters[key],
      Unit: 'Count',
      Timestamp: date,
      Dimensions: dimensions
    };
  });
}

function collectGauges(date, gauges, dimensions) {
  return Object.keys(gauges).map((key) => {
    return {
      MetricName: key,
      Value: gauges[key],
      Unit: 'None',
      Timestamp: date,
      Dimensions: dimensions
    };
  });
}

// true, if there is at least one matching item
function someMatch(list, key) {
  return _.some(list, (regex) => regex.test(key));
}

/**
 * @param {Array[String]} [options.whitelist=[]]
 * @param {Array[String]} [options.blacklist=[]]
 */
function filterMetrics(metrics = {}, options = {}) {
  const result = {};
  const whitelist = options.whitelist || [];
  const blacklist = options.blacklist || [];

  Object.keys(metrics).forEach((key) => {
    if (someMatch(whitelist, key) && !someMatch(blacklist, key)) {
      result[key] = metrics[key];
    }
  });

  return result;
}

function listDimensions(dimensions) {
  const results = [];

  Object.keys(dimensions).forEach((key) => {
    const value = dimensions[key];
    if (value && value !== '') {
      results.push({
        Name: key,
        Value: value
      });
    }
  });

  return results;
}

function reportSuccess(metricParams, stats, dumpMessages, logger) {
  stats.last_flush = Math.round(new Date().getTime() / 1000);

  if (!dumpMessages) {
    return;
  }

  const data = metricParams.MetricData;
  const counters = _.where(data, { Unit: 'Count' });
  const timers = _.where(data, { Unit: 'Milliseconds' });
  const gauges = _.where(data, { Unit: 'None' });

  const s = `cloudwatch recieved ${counters.length} counters, ${timers.length} timers and ${gauges.length} gauges`;
  logger.log(s);
}

function reportError(err, stats, dumpMessages, logger) {
  stats.last_exception = Math.round(new Date().getTime() / 1000);
  logger.log(`cloudwatch ${err.code}: ${err.message}`);
  if (dumpMessages) {
    Fmt.dump(err);
  }
}

export class Backend {
  constructor(options, time, logger) {
    options = _.defaults(options || {}, {
      client: new AWS.CloudWatch(),
      dimensions: {},
      namespace: 'unknown',
      debug: false,
      dumpMessages: false,
      whitelist: ['.*'],          // default: accept all
      blacklist: ['statsd\\.'],   // default: blacklist statsd internal metrics
      metricsLimit: 0             // default: no limit
    });

    this.logger = logger || _.noop;
    this.debug = options.debug;
    this.dumpMessages = options.dumpMessages;

    this.client = options.client;
    this.namespace = options.namespace;
    this.dimensions = listDimensions(options.dimensions);
    this.whitelist = options.whitelist.map((item) => new RegExp(item));
    this.blacklist = options.blacklist.map((item) => new RegExp(item));
    this.metricsLimit = options.metricsLimit;
    this.uniqMetrics = {};

    this.stats = {
      last_flush: time,
      last_exception: time
    };
  }

  /**
   * check the data for unique metrics and limit the amout of sent metrics if the limit is reached
   */
  limitData(data) {
    if (this.metricsLimit === 0) { // we dont want to limit at all
      return data;
    }

    let currentSize = Object.keys(this.uniqMetrics).length;

    return data.filter((metric) => {
      const metricName = metric.MetricName;

      if (this.uniqMetrics[metricName]) {
        return true;
      }

      if (currentSize >= this.metricsLimit) {
        this.logger(`cloudwatch - ERROR - metrics limit reached - throwing away ${metricName}`);
        return false;
      }

      this.uniqMetrics[metricName] = true;
      currentSize += 1;
      return true;
    });
  }

  flush(timestamp, metrics) {
    const date = new Date(timestamp * 1000);
    let data = _.union(
      collectTimers(date, filterMetrics(metrics.timers, this), this.dimensions),
      collectCounters(date, filterMetrics(metrics.counters, this), this.dimensions),
      collectGauges(date, filterMetrics(metrics.gauges, this), this.dimensions));

    // limit metrics to not create uncontrolled aws costs
    data = this.limitData(data);

    if (this.debug) {
      this.logger(`cloudwatch - flushing ${data.length} metrics`);
    }

    while (data.length > 0) {
      const params = {
        Namespace: this.namespace,
        MetricData: data.slice(0, 20)
      };

      const stats = this.stats;
      this.client.putMetricData(params, (err) => {
        if (err) {
          return reportError(err, stats, this.dumpMessages, this.logger);
        }

        return reportSuccess(params, stats, this.dumpMessages, this.logger);
      });

      data = data.slice(20);
    }
  }

  status(callback) {
    Object.keys(this.stats).forEach((key) => {
      callback(null, 'cloudwatch', key, this.stats[key]);
    });
  }
}
