import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import { connect, ReactReduxContext } from 'react-redux'
import { Router } from 'react-router'
import { matchRoutes } from 'react-router-config'
import { onLocationChanged } from './actions'
import createSelectors from './selectors'


const createConnectedRouter = (structure) => {
  const { getIn } = structure
  const { getLocation } = createSelectors(structure)

  /*
   * ConnectedRouter listens to a history object passed from props.
   * When history is changed, it dispatches action to redux store.
   * Then, store will pass props to component to render.
   * This creates uni-directional flow from history->store->router->components.
   */
  class ConnectedRouter extends PureComponent {
    componentDidMount() {
      const { store, history, onLocationChanged, routes } = this.props

      this.inTimeTravelling = false

      // Subscribe to store changes to check if we are in time travelling
      this.unsubscribe = store.subscribe(() => {
        // Extract store's location
        const {
          pathname: pathnameInStore,
          search: searchInStore,
          hash: hashInStore,
        } = getLocation(store.getState())
        // Extract history's location
        const {
          pathname: pathnameInHistory,
          search: searchInHistory,
          hash: hashInHistory,
        } = history.location

        // If we do time travelling, the location in store is changed but location in history is not changed
        if (pathnameInHistory !== pathnameInStore || searchInHistory !== searchInStore || hashInHistory !== hashInStore) {
          this.inTimeTravelling = true
          // Update history's location to match store's location
          history.push({
            pathname: pathnameInStore,
            search: searchInStore,
            hash: hashInStore,
          })
        }
      })

      const handleLocationChange = (location, action) => {
        // Dispatch onLocationChanged except when we're in time travelling
        if (!this.inTimeTravelling) {
          if (routes) {
            const matchedRoutes = matchRoutes(routes, location.pathname)
            const [currentMatchedRoute] = matchedRoutes.filter((item) => item.match.isExact)
            const match = currentMatchedRoute && currentMatchedRoute.match ? currentMatchedRoute.match : undefined

            onLocationChanged(location, action, matchedRoutes, match)
          }
          else {
            onLocationChanged(location, action)
          }
        }
        else {
          this.inTimeTravelling = false
        }
      }

      // Listen to history changes
      this.unlisten = history.listen(handleLocationChange)
      // Dispatch a location change action for the initial location.
      // This makes it backward-compatible with react-router-redux.
      // But, we add `isFirstRendering` to `true` to prevent double-rendering.
      handleLocationChange(history.location, history.action, true)
    }

    componentWillUnmount() {
      this.unlisten()
      this.unsubscribe()
    }

    render() {
      const { history, children } = this.props

      return (
        <Router history={history}>
          {children}
        </Router>
      )
    }
  }

  ConnectedRouter.propTypes = {
    store: PropTypes.shape({
      getState: PropTypes.func.isRequired,
      subscribe: PropTypes.func.isRequired,
    }).isRequired,
    history: PropTypes.shape({
      action: PropTypes.string.isRequired,
      listen: PropTypes.func.isRequired,
      location: PropTypes.object.isRequired,
      push: PropTypes.func.isRequired,
    }).isRequired,
    basename: PropTypes.string,
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
    onLocationChanged: PropTypes.func.isRequired,
    routes: PropTypes.array,
  }

  const mapStateToProps = (state) => ({
    action: getIn(state, ['router', 'action']),
    location: getIn(state, ['router', 'location']),
    matchedRoutes: getIn(state, ['router', 'matchedRoutes']),
    match: getIn(state, ['router', 'match']),
  })

  const mapDispatchToProps = (dispatch) => ({
    onLocationChanged: (location, action, matchedRoutes, match) => (
      dispatch(onLocationChanged(location, action, matchedRoutes, match))
    ),
  })

  const ConnectedRouterWithContext = (props) => {
    const Context = props.context || ReactReduxContext

    if (Context == null) {
      throw 'Please upgrade to react-redux v6'
    }

    return (
      <Context.Consumer>
        {({ store }) => <ConnectedRouter store={store} {...props} />}
      </Context.Consumer>
    )
  }

  ConnectedRouterWithContext.propTypes = {
    context: PropTypes.object,
  }

  return connect(mapStateToProps, mapDispatchToProps)(ConnectedRouterWithContext)
}

export default createConnectedRouter
