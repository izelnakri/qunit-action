import QUnit from "qunitx";
import { setup } from "qunit-dom/dist/addon-test-support/index";
import { setupRenderingTest as upstreamSetupRenderingTest } from "@emberx/test-helpers";

export function setupRenderingTest(hooks, options) {
  setup(QUnit.assert);
  upstreamSetupRenderingTest(hooks);
}
