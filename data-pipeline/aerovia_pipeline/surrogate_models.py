"""Real PyTorch flow surrogates with visible deterministic physical postprocessing."""
import numpy as np
import torch
from torch import nn


def dense(widths):
    layers = []
    for i, (start, end) in enumerate(zip(widths, widths[1:])):
        layers.append(nn.Linear(start, end))
        if i < len(widths)-2:
            layers.append(nn.SiLU())
    return nn.Sequential(*layers)


class TopologyMLP(nn.Module):
    def __init__(self, edges, hidden=128):
        super().__init__()
        self.network = dense((edges, hidden, hidden, edges))

    def forward(self, x, graph=None):
        return self.network(x)


class GraphSurrogate(nn.Module):
    """Shared directed messages; dense incidence products avoid nondeterministic scatter."""
    def __init__(self, edge_features=12, node_features=4, hidden=32, steps=4):
        super().__init__()
        self.steps = steps
        self.edge_encoder = dense((edge_features+1, hidden, hidden))
        self.node_encoder = dense((node_features, hidden, hidden))
        self.edge_update = dense((hidden*3, hidden, hidden))
        self.node_update = dense((hidden*3, hidden, hidden))
        self.readout = dense((hidden*3, hidden, 1))

    def forward(self, x, graph):
        batch = x.shape[0]
        edges = self.edge_encoder(torch.cat((x.unsqueeze(-1), graph["edge_static"].unsqueeze(0).expand(batch, -1, -1)), dim=-1))
        nodes = self.node_encoder(graph["node_static"]).unsqueeze(0).expand(batch, -1, -1)
        for _ in range(self.steps):
            start = torch.matmul(graph["source_select"], nodes)
            end = torch.matmul(graph["target_select"], nodes)
            edges = edges + .25 * self.edge_update(torch.cat((edges, start, end), dim=-1))
            incoming = torch.matmul(graph["incoming"], edges)
            outgoing = torch.matmul(graph["outgoing"], edges)
            nodes = nodes + .25 * self.node_update(torch.cat((nodes, incoming, outgoing), dim=-1))
        return self.readout(torch.cat((edges, torch.matmul(graph["source_select"], nodes), torch.matmul(graph["target_select"], nodes)), dim=-1)).squeeze(-1)


def tensor_graph(prepared, device="cpu"):
    return {key: torch.as_tensor(value, dtype=torch.float32, device=device) for key, value in prepared.items()}


def postprocess(delta, x, graph):
    raw = graph["q_base"] + delta * graph["q_scale"]
    flow = torch.matmul(raw, graph["projector"].T)
    losses = (graph["resistance"] * torch.exp(x) + graph["coefficient"]) * flow * torch.abs(flow) - graph["forcing"]
    pressure = torch.matmul(losses, graph["pressure_map"].T)
    return raw, flow, pressure


def loss_function(model, x, y, graph, physics_weight=.02):
    delta = model(x, graph)
    raw, q, p = postprocess(delta, x, graph)
    target = graph["q_base"] + y * graph["q_scale"]
    supervised = torch.mean(((q-target)/graph["q_scale"])**2)
    raw_loss = torch.mean((delta-y)**2)
    residual = (torch.matmul(p, graph["incidence"]) + graph["forcing"] -
                (graph["resistance"] * torch.exp(x) + graph["coefficient"]) * q * torch.abs(q)) / graph["p_scale"]
    return supervised + .1 * raw_loss + physics_weight * torch.mean(residual**2)


class ExportedSurrogate(nn.Module):
    """Fixed calibrated topology, dynamic batch input, physical arrays at unit speed."""
    def __init__(self, model, prepared):
        super().__init__()
        self.model = model
        self.keys = tuple(prepared)
        for key, value in prepared.items():
            self.register_buffer(key, torch.as_tensor(value, dtype=torch.float32))

    def forward(self, logResistanceRatios):
        graph = {key: getattr(self, key) for key in self.keys}
        return postprocess(self.model(logResistanceRatios, graph), logResistanceRatios, graph)


def numpy_postprocess(delta, x, prepared):
    """Independent float64 oracle for postprocessing/export parity tests."""
    raw = prepared["q_base"] + np.asarray(delta, dtype=np.float64) * prepared["q_scale"]
    flow = raw @ prepared["projector"].T
    losses = (prepared["resistance"] * np.exp(np.asarray(x, dtype=np.float64)) + prepared["coefficient"]) * flow * np.abs(flow) - prepared["forcing"]
    pressure = losses @ prepared["pressure_map"].T
    return raw, flow, pressure
