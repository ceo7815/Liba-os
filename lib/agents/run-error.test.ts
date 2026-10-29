import assert from "node:assert/strict";
import test from "node:test";
import { agentRunErrorHe } from "./run-error";

test("agent run errors are Hebrew and hidden on success", () => {
  assert.equal(agentRunErrorHe("success", "boom"), null);
  assert.equal(agentRunErrorHe("running", null), null);
  assert.equal(agentRunErrorHe("failed", null), "ההרצה נכשלה בלי פירוט.");
  assert.equal(agentRunErrorHe("cancelled", ""), "ההרצה בוטלה.");
  assert.equal(
    agentRunErrorHe("failed", "stale: running for more than 1 hour without finishing"),
    "ההרצה נתקעה יותר משעה בלי לסיים.",
  );
  assert.equal(
    agentRunErrorHe("failed", "ההרצה נתקעה יותר משעה בלי לסיים."),
    "ההרצה נתקעה יותר משעה בלי לסיים.",
  );
  assert.equal(agentRunErrorHe("partial", "שגיאת רשת"), "שגיאת רשת");
});
