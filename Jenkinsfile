pipeline {
  // Official Playwright image: Python, Node and Chromium preinstalled.
  agent { docker { image 'mcr.microsoft.com/playwright/python:v1.56.0-noble' } }
  options { timeout(time: 10, unit: 'MINUTES') }
  stages {
    stage('Install') {
      steps { sh 'python3 -m pip install --quiet -r requirements-dev.txt' }
    }
    stage('Smoke test') {
      steps { sh './scripts/test.sh' }
    }
  }
  post {
    always { archiveArtifacts artifacts: 'test-artifacts/*.png', allowEmptyArchive: true }
  }
}
