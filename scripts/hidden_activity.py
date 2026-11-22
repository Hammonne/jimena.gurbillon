"""Genera docs/data/hidden_activity.json para la tarjeta "Watching a network learn".

Datos reales: una MLP pequeña (64 -> 64 -> 32 -> 10, ReLU) entrenada con PyTorch sobre
sklearn load_digits. En varias épocas (incluida la 0, sin entrenar) guarda las activaciones
de la última capa oculta (32 neuronas) de 600 dígitos del set de prueba y las proyecta a 2D
con t-SNE, alineadas entre épocas como en Rauber et al. (2017): la proyección de la última
época se calcula primero y cada época anterior se inicializa con la de la época siguiente;
además se alinea con Procrustes para que no rote ni cambie de escala.

Uso (desde la raíz del repo):
    pip install numpy scikit-learn torch
    python scripts/hidden_activity.py
"""
import json
from pathlib import Path

import numpy as np
import torch
from scipy.linalg import orthogonal_procrustes
from sklearn.datasets import load_digits
from sklearn.manifold import TSNE
from sklearn.model_selection import train_test_split

SEED = 0
EPOCHS = 40
SNAPSHOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40]
N_TEST = 600
LR = 0.03          # moderado, sin momentum: el aprendizaje se ve gradual (~20 épocas)
BATCH = 32
OUT = Path(__file__).resolve().parent.parent / 'docs' / 'data' / 'hidden_activity.json'

torch.manual_seed(SEED)
np.random.seed(SEED)

# ---- datos ----
digits = load_digits()
X = (digits.data / 16.0).astype(np.float32)
y = digits.target.astype(np.int64)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=N_TEST, stratify=y, random_state=SEED)
Xtr_t, ytr_t, Xte_t, yte_t = map(torch.from_numpy, (Xtr, ytr, Xte, yte))

# ---- modelo ----
hidden = torch.nn.Sequential(
    torch.nn.Linear(64, 64), torch.nn.ReLU(),
    torch.nn.Linear(64, 32), torch.nn.ReLU(),
)
head = torch.nn.Linear(32, 10)
model = torch.nn.Sequential(hidden, head)
opt = torch.optim.SGD(model.parameters(), lr=LR)
loss_fn = torch.nn.CrossEntropyLoss()


def snapshot():
    model.eval()
    with torch.no_grad():
        acts = hidden(Xte_t).numpy()
        acc = (head(torch.from_numpy(acts)).argmax(1) == yte_t).float().mean().item()
    model.train()
    return acts, acc


acts, accs = {}, {}
for epoch in range(EPOCHS + 1):
    if epoch > 0:
        perm = torch.randperm(len(Xtr_t))
        for i in range(0, len(perm), BATCH):
            idx = perm[i:i + BATCH]
            opt.zero_grad()
            loss_fn(model(Xtr_t[idx]), ytr_t[idx]).backward()
            opt.step()
    if epoch in SNAPSHOTS:
        acts[epoch], accs[epoch] = snapshot()
        print(f'época {epoch:2d}  acc de prueba {accs[epoch]:.3f}')

# ---- proyección 2D alineada entre épocas (de la última hacia atrás) ----
proj = {}
nxt = None
for epoch in reversed(SNAPSHOTS):
    init = 'pca' if nxt is None else nxt
    Y = TSNE(n_components=2, perplexity=30, init=init, learning_rate='auto', random_state=SEED).fit_transform(acts[epoch])
    Y -= Y.mean(0)
    if nxt is not None:   # Procrustes: rotación + escala para que coincida con la época siguiente
        R, _ = orthogonal_procrustes(Y, nxt)
        Y = Y @ R
        Y *= np.linalg.norm(nxt) / np.linalg.norm(Y)
    proj[epoch] = Y
    nxt = Y

# giro rígido (igual para todas las épocas, no cambia distancias): el eje más largo de la última época
# queda horizontal, para aprovechar el ancho de la tarjeta
_, _, Vt = np.linalg.svd(proj[SNAPSHOTS[-1]], full_matrices=False)
proj = {e: p @ Vt.T for e, p in proj.items()}
scale = max(np.abs(p).max() for p in proj.values())
data = {
    'source': 'MLP 64-64-32-10 (ReLU, PyTorch, SGD lr 0.03) on sklearn load_digits; last hidden layer (32 units) '
              'of 600 test digits; t-SNE aligned across epochs (Rauber et al. 2017 init + Procrustes).',
    'epochs': SNAPSHOTS,
    'acc': [round(accs[e], 3) for e in SNAPSHOTS],
    'labels': yte.tolist(),
    'x': [[round(float(v), 2) for v in proj[e][:, 0] / scale] for e in SNAPSHOTS],
    'y': [[round(float(v), 2) for v in proj[e][:, 1] / scale] for e in SNAPSHOTS],
}
OUT.write_text(json.dumps(data, separators=(',', ':')))
print(f'guardado {OUT} ({OUT.stat().st_size / 1024:.0f} KB)')
