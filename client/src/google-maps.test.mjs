import { test } from 'node:test'
import assert from 'node:assert/strict'
import { googleMapsView } from './google-maps.mjs'

const origin = { latitude: 41.88, longitude: -87.63, label: 'Chicago, Illinois' }
const chargers = [
  { id: 'node/1', name: 'First charger', latitude: 41.881, longitude: -87.631 },
  { id: 'node/2', name: 'Second charger', latitude: 41.882, longitude: -87.632 },
]

test('the initial Google Maps iframe needs no API key or search location', () => {
  const view = googleMapsView()
  const embed = new URL(view.embedUrl)
  assert.equal(embed.origin, 'https://maps.google.com')
  assert.equal(embed.searchParams.get('output'), 'embed')
  assert.equal(embed.searchParams.get('q'), 'United States')
  assert.equal(embed.searchParams.get('z'), '4')
  assert.equal(embed.searchParams.has('key'), false)
  assert.equal(view.label, 'Google Maps')
})

test('the searched address centers the map and the radius changes its zoom', () => {
  for (const [radius, zoom] of [[5, '12'], [10, '11'], [25, '10']]) {
    const view = googleMapsView({ origin, radius })
    const embed = new URL(view.embedUrl)
    assert.equal(embed.searchParams.get('q'), '41.88,-87.63')
    assert.equal(embed.searchParams.get('z'), zoom)
    assert.equal(view.label, 'Search location')
    assert.match(view.title, /Chicago/)
  }
})

test('a selected OSM charger uses its exact point and identifies its list number', () => {
  const view = googleMapsView({ origin, chargers, selectedId: 'node/2', radius: 25 })
  const embed = new URL(view.embedUrl)
  assert.equal(embed.searchParams.get('q'), '41.882,-87.632')
  assert.equal(embed.searchParams.get('z'), '16')
  assert.equal(view.label, 'Charger 2')
  assert.equal(view.title, 'Second charger on Google Maps')
  const link = new URL(view.mapUrl)
  assert.equal(link.searchParams.get('api'), '1')
  assert.equal(link.searchParams.get('query'), '41.882,-87.632')
})

test('stale selection and invalid coordinates fall back to the valid search location or country view', () => {
  assert.equal(googleMapsView({ origin, chargers, selectedId: 'old-search' }).label, 'Search location')
  const view = googleMapsView({ origin: { latitude: Infinity, longitude: -87.63 } })
  assert.equal(new URL(view.embedUrl).searchParams.get('q'), 'United States')
  assert.equal(view.label, 'Google Maps')
})
