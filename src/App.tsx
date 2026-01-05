import { NavigationProvider } from './contexts/NavigationContext'
import { Layout } from './components/Layout'
import { PageRouter } from './components/PageRouter'

function App() {
  return (
    <NavigationProvider>
      <Layout>
        <PageRouter />
      </Layout>
    </NavigationProvider>
  )
}

export default App
