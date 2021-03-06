import React from 'react'
import { displayName } from '../../src/addons/with-send'

it('gets a stateless component name', function() {
  const name = displayName(function Button() {})

  expect(name).toBe('Button')
})

it('gets a class component name', function() {
  const name = displayName(class Button extends React.PureComponent {})

  expect(name).toBe('Button')
})
