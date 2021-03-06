/**
 * @fileoverview Presenter is a specialized React component that
 * creates a boundary between "smart" and "dumb" components. This
 * improves testing and keeps business logic in a consistent place
 * (instead of spread across bunches of components).
 *
 * Use Presenters to track changes to a Microcosm, push actions, and
 * manage application flow.
 */

import React from 'react'
import Microcosm, { get, merge, tag, getRegistration } from '../microcosm'
import Model from './model'

function passChildren() {
  return this.props.children ? React.Children.only(this.props.children) : null
}

const identity = () => {}

/**
 * @class
 * @extends React.PureComponent
 */
class Presenter extends React.PureComponent {
  constructor(props, context) {
    super()

    if (this.render !== Presenter.prototype.render) {
      this.defaultRender = this.render
      this.render = Presenter.prototype.render
    } else {
      this.defaultRender = passChildren
    }

    // Autobind send so that context is maintained when passing send to children
    this.send = this.send.bind(this)
  }

  _beginSetup(mediator) {
    this.repo = mediator.repo
    this.mediator = mediator

    this.setup(this.repo, this.props, this.state)

    this.model = this.mediator.updateModel(this.props, this.state)

    this.ready(this.repo, this.props, this.state)
  }

  _beginTeardown() {
    this.teardown(this.repo, this.props, this.state)
  }

  _requestRepo(contextRepo) {
    let givenRepo = this.props.repo || contextRepo
    let workingRepo = this.getRepo(givenRepo, this.props, this.state)

    this.didFork = workingRepo !== givenRepo

    return workingRepo
  }

  /**
   * Called when a presenter is created, useful any prep work. `setup`
   * runs before the first `getModel` invocation.
   * @param {Microcosm} repo
   * @param {Object} props
   * @param {Object} state
   */
  setup(repo, props, state) {
    // NOOP
  }

  /**
   * Called after the presenter has run `setup` and executed the first
   * `getModel`. This hook is useful for fetching initial data and
   * other start tasks that need access to the model data.
   * @param {Microcosm} repo
   * @param {Object} props
   * @param {Object} state
   */
  ready(repo, props, state) {
    // NOOP
  }

  /**
   * Called when a presenter gets new props. This is useful for secondary
   * data fetching and other work that must happen when a Presenter receives
   * new information.
   * @param {Microcosm} repo
   * @param {Object} nextProps
   * @param {Object} nextState
   */
  update(repo, nextProps, nextState) {
    // NOOP
  }

  /**
   * Runs when the presenter unmounts. Useful for tearing down
   * subscriptions and other setup behavior.
   * @param {Microcosm} repo
   * @param {Object} props
   * @param {Object} state
   */
  teardown(repo, props, state) {
    // NOOP
  }

  /**
   * Catch an action emitted from a child view, using an add-on
   * `ActionForm`, `ActionButton`, or `withSend`. These add-ons are
   * designed to improve the ergonomics of presenter/view
   * communication. Data down, actions up.
   */
  intercept() {
    return {}
  }

  componentWillUpdate(props, state) {
    this.model = this.mediator.updateModel(props, state)
    this.update(this.repo, props, state)
  }

  /**
   * Runs before assigning a repo to a Presenter. This method is given
   * the parent repo, either passed in via `props` or `context`. By
   * default, it returns a fork of that repo, or a new Microcosm if no
   * repo is provided.
   *
   * This provides an opportunity to customize the repo behavior for a
   * particular Presenter. For example, to circumvent the default
   * Presenter forking behavior:
   * @param {Microcosm} repo
   * @param {Object} props
   */
  getRepo(repo, props) {
    return repo ? repo.fork() : new Microcosm()
  }

  /**
   * Bubble an action up through the presenter tree. If no parent
   * presenter responds to the action within their `intercept()`
   * method, then dispatch it to the root Microcosm repo.
   *
   * This works exactly like the `send` property passed into a
   * component that is wrapped in the `withSend` higher order
   * component.
   * @param {Function|string} action
   * @param {...*} params
   */
  send() {
    return this.mediator.send(...arguments)
  }

  /**
   * Builds a view model for the current props and state. This must
   * return an object of key/value pairs.
   * @param {Object} presenterProps
   * @param {Object} presenterState
   */
  getModel(presenterProps, presenterState) {
    return {}
  }

  render() {
    return React.createElement(PresenterMediator, {
      presenter: this,
      parentState: this.state,
      parentProps: this.props
    })
  }
}

class PresenterMediator extends React.PureComponent {
  static contextTypes = {
    repo: identity,
    send: identity
  }

  static childContextTypes = {
    repo: identity,
    send: identity
  }

  constructor(props, context) {
    super(props, context)

    this.presenter = props.presenter

    this.repo = this.presenter._requestRepo(context.repo)
    this.send = this.send.bind(this)

    this.state = { repo: this.repo, send: this.send }

    this.model = new Model(this.repo, this.presenter)

    this.model.on('change', this.assignModel, this)
  }

  getChildContext() {
    return {
      repo: this.repo,
      send: this.send
    }
  }

  componentWillMount() {
    this.presenter._beginSetup(this)
  }

  componentDidMount() {
    this.presenter.refs = this.refs
  }

  componentWillUnmount() {
    this.presenter.refs = this.refs

    if (this.presenter.didFork) {
      this.repo.shutdown()
    }

    this.model.teardown()

    this.presenter._beginTeardown()
  }

  render() {
    // setState might have been called before the model
    // can get assigned
    this.presenter.model = this.state

    // Views can be getters, so pluck it out so that it is only evaluated once
    const view = this.presenter.view

    if (view != null) {
      return React.createElement(view, merge(this.presenter.props, this.state))
    }

    return this.presenter.defaultRender()
  }

  assignModel(state) {
    this.setState(() => state)
  }

  updateModel(props, state) {
    let bindings = this.presenter.getModel(props, state)

    this.model.bind(bindings)

    return this.model.value
  }

  hasParent() {
    // Do not allow transfer across repos. Check to for inheritence by comparing
    // the common history object shared between repos
    return get(this.repo, 'history') === get(this.context, ['repo', 'history'])
  }

  send(intent, ...params) {
    // tag intent first so the interceptor keys off the right key
    let taggedIntent = tag(intent)

    let interceptors = this.presenter.intercept()

    // A presenter's register goes through the same registration steps
    let handler = getRegistration(interceptors, taggedIntent, 'resolve')

    // Does the presenter register to this intent?
    if (handler) {
      return handler.call(this.presenter, this.repo, ...params)
    }

    // No: try the parent presenter
    if (this.hasParent()) {
      return this.context.send.apply(null, arguments)
    }

    // If we hit the top, push the intent into the Microcosm instance
    return this.repo.push.apply(this.repo, arguments)
  }
}

export default Presenter
