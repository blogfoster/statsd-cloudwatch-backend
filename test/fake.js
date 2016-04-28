class CloudWatch {
  constructor() {
    // this.Namespace = ''
    // this.MetricData = []
    this.params = [];
  }

  putMetricData(params, complete) {
    this.params.push(params);
    complete(null, {});
  }
}

export default {
  CloudWatch
};
