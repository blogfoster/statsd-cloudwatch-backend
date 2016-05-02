/* eslint prefer-arrow-callback: 0, func-names: 0, no-unused-expressions: 0 */

import { expect } from 'chai';
import _ from 'underscore';
import Fixture from './fixture';
import Fake from './fake';
import { Backend } from '../lib/backend';

describe('new backend', function () {
  const backend = new Backend();

  it('should have a namespace', function () {
    expect(backend.namespace).to.exist;
  });

  it('should have a cloudwatch client', function () {
    expect(backend.client).to.exist;
  });

  it('should have a dimensions array', function () {
    expect(backend.dimensions).to.have.length(0);
  });

  it('should have stats', function () {
    expect(backend.stats).to.not.be.empty;
  });
});

describe('flush with no metrics', function () {
  const cloudwatch = new Fake.CloudWatch();
  const backend = new Backend({
    client: cloudwatch,
    namespace: 'abc.123'
  });

  beforeEach(function () {
    backend.flush(Fixture.timestamp, {});
  });

  it('should not send counters', function () {
    expect(cloudwatch.params).to.have.length(0);
  });
});

describe('flush with too many metrics', function () {
  const cloudwatch = new Fake.CloudWatch();
  const backend = new Backend({
    client: cloudwatch,
    namespace: 'abc.123'
  });

  beforeEach(function () {
    backend.flush(Fixture.timestamp, {
      counters: Fixture.manyCounters
    });
  });

  it('should break metrics into 2 calls to Cloudwatch', function () {
    expect(cloudwatch.params).to.have.length(2);
    expect(cloudwatch.params[0].MetricData).to.have.length(20);
    expect(cloudwatch.params[1].MetricData).to.have.length(1);
  });
});

describe('flushing counters', function () {
  let metric;
  const cloudwatch = new Fake.CloudWatch();
  const backend = new Backend({
    client: cloudwatch,
    namespace: 'abc.123'
  });

  beforeEach(function () {
    backend.flush(Fixture.timestamp, {
      counters: Fixture.counters
    });
    metric = _.first(_.first(cloudwatch.params).MetricData);
  });

  it('should send a namespace', function () {
    expect(cloudwatch.params[0].Namespace).to.equal('abc.123');
  });

  it('should send a counter', function () {
    expect(metric).to.exist;
    expect(metric.Unit).to.equal('Count');
  });

  it('should send a metric name', function () {
    expect(metric.MetricName).to.equal('api.request_count');
  });

  it('should send a count', function () {
    expect(metric.Value).to.equal(100);
  });

  it('should send a timestamp', function () {
    expect(metric.Timestamp.getTime()).to.equal(Fixture.now.getTime());
  });

  it('should not send a dimension', function () {
    const dimensions = metric.Dimensions;
    expect(dimensions).to.have.length(0);
  });

  it('should not send a statsd counter', function () {
    const counters = _.filter(_.first(cloudwatch.params).MetricData, function (c) {
      return c.MetricName.indexOf('statsd.') === 0;
    });
    expect(counters).to.have.length(0);
  });
});

describe('flushing timers', function () {
  let metric;
  const cloudwatch = new Fake.CloudWatch();
  const backend = new Backend({
    client: cloudwatch,
    namespace: 'abc.123',
    dimensions: {
      InstanceId: 'i-xyz'
    }
  });

  beforeEach(function () {
    backend.flush(Fixture.timestamp, {
      timers: Fixture.timers
    });
    metric = _.first(cloudwatch.params[0].MetricData);
  });

  it('should send a namespace', function () {
    expect(cloudwatch.params[0].Namespace).to.equal('abc.123');
  });

  it('should send a timer', function () {
    expect(metric).to.exist;
    expect(metric.Unit).to.equal('Milliseconds');
  });

  it('should send a metric name', function () {
    expect(metric.MetricName).to.equal('api.request_time');
  });

  it('should send a sum', function () {
    expect(metric.StatisticValues.Sum).to.equal(10);
  });

  it('should send a min', function () {
    expect(metric.StatisticValues.Minimum).to.equal(0);
  });

  it('should send a max', function () {
    expect(metric.StatisticValues.Maximum).to.equal(4);
  });

  it('should send a sample count', function () {
    expect(metric.StatisticValues.SampleCount).to.equal(5);
  });

  it('should send a timestamp', function () {
    expect(metric.Timestamp.getTime()).to.equal(Fixture.now.getTime());
  });

  it('should send a dimension', function () {
    const dimensions = metric.Dimensions;
    expect(dimensions).to.have.length(1);
    expect(dimensions[0].Name).to.equal('InstanceId');
    expect(dimensions[0].Value).to.equal('i-xyz');
  });
});

describe('flushing gauges', function () {
  let metric;
  const cloudwatch = new Fake.CloudWatch();
  const backend = new Backend({
    client: cloudwatch,
    namespace: 'abc.123',
    dimensions: {
      InstanceId: 'i-xyz'
    }
  });

  beforeEach(function () {
    backend.flush(Fixture.timestamp, {
      gauges: Fixture.gauges
    });
    metric = _.first(cloudwatch.params[0].MetricData);
  });

  it('should send a namespace', function () {
    expect(cloudwatch.params[0].Namespace).to.equal('abc.123');
  });

  it('should send a gauge', function () {
    expect(metric).to.exist;
    expect(metric.Unit).to.equal('None');
  });

  it('should send a metric name', function () {
    expect(metric.MetricName).to.equal('api.num_sessions');
  });

  it('should send a value', function () {
    expect(metric.Value).to.equal(50);
  });

  it('should send a timestamp', function () {
    expect(metric.Timestamp.getTime()).to.equal(Fixture.now.getTime());
  });

  it('should send a dimension', function () {
    const dimensions = metric.Dimensions;
    expect(dimensions).to.have.length(1);
    expect(dimensions[0].Name).to.equal('InstanceId');
    expect(dimensions[0].Value).to.equal('i-xyz');
  });

  it('should not send a statsd gauge', function () {
    const gauges = _.filter(cloudwatch.MetricData, function (c) {
      return c.MetricName.indexOf('statsd.') === 0;
    });
    expect(gauges).to.have.length(0);
  });
});

describe('whitelisting', function () {
  before(function () {
    this.cloudwatch = new Fake.CloudWatch();
    this.backend = new Backend({
      client: this.cloudwatch, namespace: 'abc.123', whitelist: ['api\\.']
    });
  });

  beforeEach(function () {
    this.backend.flush(Fixture.timestamp, {
      counters: _.extend(Fixture.counters, { 'api2.request_count': 100 })
    });
  });

  it('should send only counters that match the whitelist', function () {
    expect(this.cloudwatch.params[0].MetricData).to.have.length(1);
    expect(this.cloudwatch.params[0].MetricData[0].MetricName).to.equal('api.request_count');
  });
});

describe('blacklisting', function () {
  before(function () {
    this.cloudwatch = new Fake.CloudWatch();
    this.backend = new Backend({
      client: this.cloudwatch, namespace: 'abc.123', blacklist: ['api\\.', 'statsd\\.']
    });
  });

  beforeEach(function () {
    this.backend.flush(Fixture.timestamp, {
      counters: _.extend(Fixture.counters, { 'api2.request_count': 100 })
    });
  });

  it('should send only counters that match the whitelist', function () {
    expect(this.cloudwatch.params[0].MetricData).to.have.length(1);
    expect(this.cloudwatch.params[0].MetricData[0].MetricName).to.equal('api2.request_count');
  });
});

describe('status', function () {
  const cloudwatch = new Fake.CloudWatch();
  const backend = new Backend({
    client: cloudwatch, namespace: 'abc.123'
  }, 123);

  let backendName;
  const backendStatus = {};

  beforeEach(function () {
    backend.status(function (err, name, key, value) {
      backendName = name;
      backendStatus[key] = value;
    });
  });

  it('should provide a backend name', function () {
    expect(backendName).to.equal('cloudwatch');
  });

  it('should report a last_flush', function () {
    expect(backendStatus.last_flush).to.equal(123);
  });

  it('should report a last_exception', function () {
    expect(backendStatus.last_exception).to.equal(123);
  });
});
