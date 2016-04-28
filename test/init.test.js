/* eslint prefer-arrow-callback: 0, func-names: 0, no-unused-expressions: 0 */

import { expect } from 'chai';
import sinon from 'sinon';
import AWS from 'aws-sdk';
import * as init from '../lib/init';
import * as backend from '../lib/backend';
import _ from 'underscore';

describe('init', function () {
  describe('#init', function () {
    before(function () {
      sinon.stub(AWS.MetadataService.prototype, 'request');
      sinon.spy(backend, 'Backend');

      this.ms = AWS.MetadataService.prototype;
      this.emitter = sinon.stub({ on: _.noop });
      this.logger = sinon.stub({ log: _.noop });
    });

    beforeEach(function () {
      this.config = {
        cloudwatch: {
          namespace: 'test-namespace',
          region: 'test-region',
          dimensions: {
            InstanceId: '<%= InstanceId %>'
          }
        }
      };
    });

    after(function () {
      AWS.MetadataService.prototype.request.restore();
      backend.Backend.reset();
    });

    it('should update given dimension fields with found metadata items', function () {
      this.ms.request.yields(null, 'id-123');
      init.init(null, this.config, this.emitter, this.logger);

      expect(backend.Backend.called).to.true;
      expect(backend.Backend.getCall(0).args[0].dimensions).to.have.property('InstanceId', 'id-123');
    });
  });
});
