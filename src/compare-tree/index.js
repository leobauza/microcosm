import Node from './node'
import Query from './query'

import {
  getKeyPaths,
  getKeyString
} from '../key-path'

const ROOT_KEY = '~'

export default function CompareTree (initial) {
  this.snapshot = initial
  this.nodes = {}
}

CompareTree.prototype = {

  /**
   * Create a subscription to a particular set of key paths.
   * @public
   * @param {String} keyPaths A list of key paths to trigger the callback
   * @param {Function} callback Function to execute when a key path changes
   * @param {*} [scope] Optional scope to invoke the function with
   */
  on (keyPaths, callback, scope) {
    let dependencies = getKeyPaths(keyPaths)
    let id = Query.getId(keyPaths)

    let query = this.addQuery(id, dependencies)

    dependencies.map(this.track, this)
                .forEach(node => node.connect(query))

    query.on('change', callback, scope)

    return query
  },

  /**
   * Remove a subscription created by .on()
   * @public
   * @param {String} keyPaths A list of key paths for the subscription
   * @param {Function} callback Associated callback function
   * @param {*} [scope] Associated scope
   */
  off (keyPaths, callback, scope) {
    let id = Query.getId(keyPaths)

    let query = this.nodes[id]

    if (query) {
      query.off('change', callback, scope)

      if (query.isEmpty()) {
        this.prune(query)
      }
    }
  },

  /**
   * Compare a new snapshot to the last snapshot, triggering event
   * subscriptions along the way.
   * @public
   * @param {*} state - New snapshot of state
   */
  update (snapshot) {
    let last = this.snapshot
    this.snapshot = snapshot

    let root = this.nodes[ROOT_KEY]

    if (root) {
      this.scan(root, last, snapshot)
    }
  },

  /**
   * Add a node to the tree if it has not otherwise been added.
   * @private
   * @param {String} id Identifier for the node.
   * @param {String} key Each node represents a key in a nested object.
   * @param {Node} parent Parent to connect this node to.
   */
  addNode (id, key, parent) {
    if (!this.nodes[id]) {
      this.nodes[id] = new Node(id, key, parent)
    }

    return this.nodes[id]
  },

  /**
   * Add a query to the tree if it has not otherwise been
   * added. Queries are leaf nodes responsible for managing
   * subscriptions.
   * @private
   * @param {String} id Identifier for the node.
   * @param {String} keyPaths Each query tracks a list of key paths
   */
  addQuery (id, keyPaths) {
    if (!this.nodes[id]) {
      this.nodes[id] = new Query(id, keyPaths)
    }

    return this.nodes[id]
  },

  /**
   * Remove a query, then traverse that queries key paths to remove
   * unused parents.
   * @private
   * @param {Query} query Query to remove
   */
  prune (query) {
    let { keyPaths } = query

    for (var i = 0, len = keyPaths.length; i < len; i++) {
      let path = keyPaths[i]
      let id = path.length ? getKeyString(keyPaths[i]) : ROOT_KEY
      let node = this.nodes[id]

      node.disconnect(query)

      do {
        if (node.isAlone()) {
          node.orphan()
          delete this.nodes[node.id]
        }

        node = node.parent
      } while (node)
    }

    delete this.nodes[query.id]
  },

  /**
   * Build up a branch of nodes given a path of keys
   * @private
   * @param {String} path A list of keys
   */
  track (path) {
    let last = this.addNode(ROOT_KEY, '', null)
    let keyBase = ''

    for (var i = 0, len = path.length; i < len; i++) {
      keyBase = keyBase ? `${keyBase}.${path[i]}` : path[i]

      last = this.addNode(keyBase, path[i], last)
    }

    return last
  },

  /**
   * Traverse the tree of subscriptions, triggering queries along the way
   * @private
   * @param {Node} root Starting point to scan
   * @param {*} from Starting snapshot
   * @param {*} from Next snapshot
   */
  scan (root, from, to) {
    let stack = [{ node: root, last: from, next: to }]

    while (stack.length) {
      var { node, last, next } = stack.pop()

      if (last !== next) {
        node.revision += 1

        var edges = node.edges
        for (var i = 0, len = edges.length; i < len; i++) {
          var edge = edges[i]

          if (node.revision > edge.revision) {
            edge.revision = node.revision

            if (edge instanceof Query) {
              edge.trigger(this.snapshot)
            } else {
              stack.push({
                node: edge,
                last: last == null ? last : last[edge.key],
                next: next == null ? next : next[edge.key]
              })
            }
          }
        }
      }
    }
  }

}
