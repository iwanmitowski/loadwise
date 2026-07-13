import type { OptimizationResult, OptimizerConfig } from './optimization'
import type { Scenario } from './scenario'

export type OptimizeRequest = {
  type: 'optimize'
  requestId: string
  scenario: Scenario
  config: OptimizerConfig
}

export type OptimizerProgress = {
  type: 'progress'
  requestId: string
  percent: number
  stage: string
}

export type OptimizerDone = {
  type: 'done'
  requestId: string
  result: OptimizationResult
}

export type OptimizerError = {
  type: 'error'
  requestId: string
  message: string
}

export type OptimizerResponse = OptimizerProgress | OptimizerDone | OptimizerError
