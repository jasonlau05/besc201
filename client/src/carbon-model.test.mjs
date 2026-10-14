import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ANNUAL_MILES, CARBON_BASELINE, carbonModel, gasEmissionsPerMile } from './carbon-model.mjs'
const inputs = { evProduction: 12, gasProduction: 8, gridIntensity: 400, efficiency: 30, gasIntensity: 400, annualMiles: 12000 }
test('break-even intersection uses tonnes-to-grams conversion', () => {
  const model = carbonModel(inputs)
  assert.equal(model.evPerMile, 120)
  assert.ok(Math.abs(model.breakEvenMiles - 14285.7142857) < 0.001)
  assert.ok(Math.abs(model.evAt(model.breakEvenMiles) - model.gasAt(model.breakEvenMiles)) < 1e-10)
  assert.ok(model.evAt(150000) < model.gasAt(150000))
})
test('handles no break-even and an initial EV advantage', () => {
  assert.equal(carbonModel({ ...inputs, gridIntensity: 1200, efficiency: 50 }).breakEvenMiles, null)
  assert.equal(carbonModel({ ...inputs, gridIntensity: 800, efficiency: 50 }).breakEvenMiles, null)
  assert.equal(carbonModel({ ...inputs, evProduction: 6 }).breakEvenMiles, 0)
})
test('fixed average comparison intersects and mileage changes years, not break-even distance', () => {
  const input = { ...CARBON_BASELINE, evProduction: 12, efficiency: 30, annualMiles: 12000 }
  const model = carbonModel(input)
  assert.equal(model.evPerMile, 110.1)
  assert.ok(Math.abs(model.breakEvenMiles - 13797.861331) < 0.001)
  assert.ok(Math.abs(model.evAt(model.breakEvenMiles) - model.gasAt(model.breakEvenMiles)) < 1e-10)
  const moreDriving = carbonModel({ ...input, annualMiles: 24000 })
  assert.equal(moreDriving.breakEvenMiles, model.breakEvenMiles)
  assert.equal(moreDriving.years, model.years / 2)
})
test('efficient gas car supports no break-even within the restored EV slider range', () => {
  const gasIntensity = gasEmissionsPerMile(60)
  const model = carbonModel({ ...CARBON_BASELINE, gasIntensity, evProduction: 12, efficiency: 50, annualMiles: ANNUAL_MILES })
  assert.ok(model.evPerMile > gasIntensity)
  assert.equal(model.breakEvenMiles, null)
  assert.equal(model.years, null)
  assert.ok(model.evAt(150000) > model.gasAt(150000))
  assert.ok(model.evAt(1000000) > model.gasAt(1000000))
})
test('MPG affects carbon break-even and uses the fixed annual driving assumption', () => {
  const inputs = { ...CARBON_BASELINE, evProduction: 12, efficiency: 30, annualMiles: ANNUAL_MILES }
  const gas30 = carbonModel({ ...inputs, gasIntensity: gasEmissionsPerMile(30) })
  const gas60 = carbonModel({ ...inputs, gasIntensity: gasEmissionsPerMile(60) })
  assert.equal(ANNUAL_MILES, 13662)
  assert.equal(gasEmissionsPerMile(30), 8887 / 30)
  assert.ok(gas60.breakEvenMiles > gas30.breakEvenMiles)
  assert.equal(gas30.years, gas30.breakEvenMiles / 13662)
})
