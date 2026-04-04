

What

Remove KubernetesClient dependency from NAOS and replace it by Platform Core's ContainerOrch.K8s



Why

We use the KubernetesClient to create a Kubernetes Job resource. This feature is already provided by Platform Core’s ContainerOrch.K8s, which also guarantees some metadata K8s resources should have. Therefore, there is no need to reinvent the wheel on NAOS.



Acceptance Criteria





NAOS migrates from KubernetesClient to Platform Core’s ContainerOrch.K8s



The Kubernetes Job created by NAOS has the same (or equivalent) spec



How

See https://github.com/OutSystems/platform-api-core/tree/main/src/ContainerOrch.K8S|https://github.com/OutSystems/platform-api-core/tree/main/src/ContainerOrch.K8S

—