import type { ConfigJson, GraphJson } from "./types"

export const configJson: ConfigJson = {
  "stage_install": {
    "command": "npx tsc --noEmit",
    "timeout": 300,
    "retries": 2,
    "env": [],
    "secrets": []
  },
  "stage_build": {
    "command": "npm run build",
    "timeout": 600,
    "retries": 1,
    "env": [{ key: "NODE_ENV", value: "production" }],
    "secrets": []
  },
  "stage_test": {
    "command": "npm run lint",
    "timeout": 600,
    "retries": 0,
    "env": [{ key: "CI", value: "true" }],
    "secrets": []
  },
  "stage_approve": {
    "command": null,
    "timeout": 0,
    "retries": 0,
    "env": [],
    "secrets": []
  },
  "stage_deploy": {
    "command": "./scripts/deploy.sh",
    "timeout": 900,
    "retries": 0,
    "env": [{ key: "TARGET", value: "prod" }],
    "secrets": ["DATABASE_URL", "API_SECRET_KEY"]
  }
}

export const graphJson: GraphJson = {
  "nodes": [
    { "id": "stage_install", "type": "standardStage", "position": { "x": 0,   "y": 120 }, "data": { "type": "custom",   "name": "install",      "label": "script" } },
    { "id": "stage_build",   "type": "standardStage", "position": { "x": 240, "y": 40  }, "data": { "type": "custom",   "name": "build",        "label": "build"  } },
    { "id": "stage_test",    "type": "standardStage", "position": { "x": 240, "y": 200 }, "data": { "type": "custom",   "name": "test",         "label": "test"   } },
    { "id": "stage_approve", "type": "standardStage", "position": { "x": 480, "y": 120 }, "data": { "type": "approval", "name": "approve prod", "label": "Approval" } },
    { "id": "stage_deploy",  "type": "standardStage", "position": { "x": 720, "y": 120 }, "data": { "type": "deploy",   "name": "deploy",       "label": "Deploy" } }
  ],
  "edges": [
    { "id": "e1", "source": "stage_install", "target": "stage_build"   },
    { "id": "e2", "source": "stage_install", "target": "stage_test"    },
    { "id": "e3", "source": "stage_build",   "target": "stage_approve" },
    { "id": "e4", "source": "stage_test",    "target": "stage_approve" },
    { "id": "e5", "source": "stage_approve", "target": "stage_deploy"  }
  ]
}