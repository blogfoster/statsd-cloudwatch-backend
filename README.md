# StatsD CloudWatch Backend

This is a pluggable backend for [StatsD][001]. It publishes stats to [Amazon's AWS CloudWatch][002].

[![wercker status][003]][004]

*Counters*, *Gauges*, and *Timers* are supported. *Sets* are not implemented yet.

Be aware that AWS CloudWatch metrics are not free and the cost can quickly become prohibative.
*Pricing details: [Amazon CloudWatch Pricing][005].* This may be a good choice if your needs
are simple and/or as a means of quickly getting off the ground, as setting up [Graphite][006] in
EC2 is not trivial.


## Requirements

* [StatsD deamon][007] versions >= 0.7.0.
* An [Amazon AWS][008] account.

## Installation

```bash
$> cd /path/to/statsd
$> npm install statsd-cloudwatch-backend
```


## Configuration

Add `statsd-cloudwatch-backend` to the list of backends in the StatsD configuration file:

```javascript
{
  backends: ['statsd-cloudwatch-backend']
}
```

Add the following basic configuration information to the StatsD configuration file.

```javascript
{
  cloudwatch: {
    namespace:  'my.api',
    region: 'us-west-2',
    dimensions: {},
    accessKeyId:  '<YOUR ACCESS KEY ID>',
    secretAccessKey: '<YOUR SECRET ACCESS KEY>',
    whitelist: ['.*'],
    blacklist: ['statsd\\.'],
    metricsLimit: 0
  }
}
```

- **`namespace`** *{String}* - aws cloudwatch metrics namespace
- **`region`** *{String}* - aws region where to send data to
- **`[dimensions={}]`** *{Map}* - optional;
- **`[accessKeyId]`**  *{String}* - optional; aws access key
- **`[secretAccessKey]`** *{String}* - optional; aws secret access key
- **`[whitelist=['.*']]`** *{Array.{String}}* - optional; whitelist of metrics
- **`[blacklist=['.statsd\\.']]`** *{Array.{String}}* - optional; blacklist of metrics
- **`[metricsLimit=0]`** *{Number}* - optional; limit of unique metrics that can be sent out in total

### White- and Blacklisting

A given metric will only be sent to AWS Cloudwatch if there is at least one matching
whitelist entry and no matching blacklist entry.


<!-- Links -->

[001]: https://github.com/etsy/statsd
[002]: http://aws.amazon.com/cloudwatch/
[003]: https://app.wercker.com/status/58736e11e8e13ee79479cd1678cb2fb3/m "wercker status"
[004]: https://app.wercker.com/project/bykey/58736e11e8e13ee79479cd1678cb2fb3
[005]: http://aws.amazon.com/cloudwatch/pricing/
[006]: http://graphite.wikidot.com/
[007]: https://npmjs.org/package/statsd
[008]: https://aws.amazon.com
