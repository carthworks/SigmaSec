import { expect, test } from "vitest"
import { renderToString } from "react-dom/server"
import { SeverityBadge } from "./severity-badge"
import React from "react"

test("renders SeverityBadge with critical severity and displays bg-red- class", () => {
  const html = renderToString(<SeverityBadge severity="critical" />)
  expect(html).toContain("bg-red-")
  expect(html).toContain("critical")
})

test("renders SeverityBadge with high severity and displays bg-orange- class", () => {
  const html = renderToString(<SeverityBadge severity="high" />)
  expect(html).toContain("bg-orange-")
  expect(html).toContain("high")
})

