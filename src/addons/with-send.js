/**
 * Connect a component to the presenter tree
 */

import { createElement } from 'react'
import { merge } from '../microcosm'

export function displayName(Component) {
  return Component.displayName || Component.name || 'Component'
}

const CONTEXT_TYPES = {
  send: () => {}
}

export default function withSend(Component) {
  function withSend(props, context) {
    let send = props.send || context.send

    return createElement(Component, merge({ send }, props))
  }

  withSend.displayName = 'withSend(' + displayName(Component) + ')'

  withSend.contextTypes = CONTEXT_TYPES

  withSend.WrappedComponent = Component

  return withSend
}
