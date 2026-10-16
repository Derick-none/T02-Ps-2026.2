/* ==========================================================================
   1. ESTADO LOCAL (apenas espelho do que o ESP32 informa)
   ========================================================================== */
let modoOperacaoAtual = 'automatico'; // 'ligado' | 'desligado' | 'automatico'
let graficoHistorico = null;
let limitesPreenchidos = false;       // preenche os inputs só na 1ª resposta

const maxPontosGrafico = 10;
const labelsHorario = [];
const dadosTemperatura = [];
const dadosUmidade = [];

/* ==========================================================================
   2. INICIALIZAÇÃO
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  inicializarGrafico();

  document.getElementById('btn-ligado').addEventListener('click', () => alterarModoOperacao('ligado'));
  document.getElementById('btn-desligado').addEventListener('click', () => alterarModoOperacao('desligado'));
  document.getElementById('btn-automatico').addEventListener('click', () => alterarModoOperacao('automatico'));
  document.getElementById('btn-solicitar-leitura').addEventListener('click', solicitarLeitura);
  document.getElementById('form-limites').addEventListener('submit', salvarLimites);

  buscarDados(false);
  // Atualização periódica (NF03). No modo automático cada resposta vira um ponto do gráfico.
  setInterval(() => buscarDados(modoOperacaoAtual === 'automatico'), 2000);
});

/* ==========================================================================
   3. COMUNICAÇÃO COM O ESP32
   ========================================================================== */
async function chamarApi(url, metodo = 'GET') {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), 4000); // não fica esperando para sempre
  try {
    const resp = await fetch(url, { method: metodo, signal: controle.signal });
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(corpo.erro || `HTTP ${resp.status}`);
    return corpo;
  } finally {
    clearTimeout(timer);
  }
}

const esperar = (ms) => new Promise((res) => setTimeout(res, ms));

async function buscarDados(adicionarNoGrafico) {
  try {
    const dados = await chamarApi('/api/dados');
    renderizar(dados, adicionarNoGrafico);
  } catch (erro) {
    mostrarSemComunicacao();
  }
}

/* ==========================================================================
   4. RENDERIZAÇÃO (tudo vem do JSON do ESP32)
   ========================================================================== */
function renderizar(d, adicionarNoGrafico) {
  modoOperacaoAtual = d.modo;
  aplicarModoNaTela(d.modo);

  atualizarStatusRede(d.wifi_conectado, d.ip);

  const temValor = d.leituraSensor && typeof d.temperatura === 'number' && typeof d.umidade === 'number';
  const temp = temValor ? d.temperatura.toFixed(1) : '--';
  const umid = temValor ? d.umidade.toFixed(1) : '--';

  let texto;
  let cor;
  if (d.modo === 'desligado') {
    texto = 'Aquisição de Dados Suspensa (Modo Desligado)';
    cor = '#64748b';
  } else if (d.modo === 'ligado' && !d.leituraSensor && d.sensorEstado === false) {
    texto = 'Aguardando solicitação de leitura (Modo Ligado)';
    cor = '#64748b';
  } else if (!d.leituraSensor) {
    texto = 'Dados indisponíveis: falha na leitura do sensor';
    cor = '#ef4444';
  } else if (d.alerta) {
    texto = 'ALERTA: Limite Excedido!';
    cor = '#ef4444';
  } else {
    texto = 'Leitura OK (Dados Atualizados)';
    cor = '#15803d';
  }

  atualizarInterfaceComValores(temp, umid, texto, cor);

  if (!limitesPreenchidos) {
    document.getElementById('limite-temp').value = d.limiteTemperatura;
    document.getElementById('limite-umidade').value = d.limiteUmidade;
    limitesPreenchidos = true;
  }

  if (adicionarNoGrafico && temValor) {
    adicionarPontoAoGrafico(d.temperatura, d.umidade);
  }
}

function atualizarInterfaceComValores(temp, umid, texto, cor) {
  document.getElementById('temp-valor').innerText = temp;
  document.getElementById('umidade-valor').innerText = umid;
  const elStatus = document.getElementById('status-sensor');
  elStatus.innerText = texto;
  elStatus.style.color = cor;
}

function atualizarStatusRede(conectado, ip) {
  const elWifi = document.getElementById('wifi-status');
  const elIp = document.getElementById('esp-ip');
  if (conectado) {
    elWifi.innerText = 'Conectado (OK)';
    elWifi.style.color = '#4ade80';
  } else {
    elWifi.innerText = 'Desconectado';
    elWifi.style.color = '#f87171';
  }
  elIp.innerText = ip && ip !== '0.0.0.0' ? ip : '--.--.--.--';
}

function mostrarSemComunicacao() {
  const elWifi = document.getElementById('wifi-status');
  elWifi.innerText = 'Sem resposta do ESP32';
  elWifi.style.color = '#f87171';
  atualizarInterfaceComValores('--', '--', 'Sem comunicação com o ESP32', '#ef4444');
}

/* ==========================================================================
   5. MODO DE OPERAÇÃO E LEDs (RF03, RF04)
   ========================================================================== */
function aplicarModoNaTela(modo) {
  const rotulos = { ligado: 'Ligado (Manual)', desligado: 'Desligado', automatico: 'Automático' };
  document.getElementById('modo-ativo').innerText = rotulos[modo] || modo;

  document.querySelectorAll('.botoes-grupo .btn').forEach((b) => b.classList.remove('ativo'));
  document.getElementById(`btn-${modo}`)?.classList.add('ativo');

  document.getElementById('btn-solicitar-leitura').disabled = (modo !== 'ligado');

  // Espelha os 3 LEDs físicos (a mesma lógica do firmware)
  setLed('led-azul-1', modo === 'desligado');
  setLed('led-azul-2', modo === 'automatico');
  setLed('led-azul-3', modo === 'ligado');
}

function setLed(id, aceso) {
  document.getElementById(id).className = aceso ? 'led-indicador on' : 'led-indicador off';
}

async function alterarModoOperacao(novoModo) {
  try {
    const dados = await chamarApi(`/api/modo?selecionado=${novoModo}`, 'POST');
    renderizar(dados, false);
  } catch (erro) {
    mostrarMensagem(`Não foi possível alterar o modo: ${erro.message}`, 'erro');
  }
}

/* ==========================================================================
   6. LEITURA SOB DEMANDA (exclusiva do Modo Ligado)
   ========================================================================== */
async function solicitarLeitura() {
  if (modoOperacaoAtual !== 'ligado') return;

  const btn = document.getElementById('btn-solicitar-leitura');
  btn.disabled = true;
  btn.innerText = 'Lendo sensor...';

  try {
    await chamarApi('/api/leitura-demanda', 'POST'); // ESP32 só levanta uma flag
    await esperar(600);                              // dá tempo do loop() ler o DHT11
    const dados = await chamarApi('/api/dados');
    renderizar(dados, true);                         // true = adiciona ponto no gráfico
  } catch (erro) {
    mostrarMensagem(`Falha na leitura sob demanda: ${erro.message}`, 'erro');
  } finally {
    btn.innerText = 'Solicitar Nova Leitura';
    btn.disabled = (modoOperacaoAtual !== 'ligado');
  }
}

/* ==========================================================================
   7. LIMITES DE ALERTA (RF07, RF08) - enviados ao ESP32
   ========================================================================== */
async function salvarLimites(event) {
  event.preventDefault();

  const temp = parseFloat(document.getElementById('limite-temp').value);
  const umid = parseFloat(document.getElementById('limite-umidade').value);

  if (isNaN(temp) || isNaN(umid)) {
    mostrarMensagem('Informe valores numéricos válidos.', 'erro');
    return;
  }

  try {
    const dados = await chamarApi(`/api/limites?temp=${temp}&umid=${umid}`, 'POST');
    renderizar(dados, false);
    mostrarMensagem(`Limites salvos no ESP32: Temp Máx = ${dados.limiteTemperatura}°C | Umidade Máx = ${dados.limiteUmidade}%`, 'ok');
  } catch (erro) {
    mostrarMensagem(`Não foi possível salvar os limites: ${erro.message}`, 'erro');
  }
}

function mostrarMensagem(texto, tipo) {
  const painel = document.getElementById('painel-alerta');
  painel.className = 'alerta-box';
  if (tipo === 'ok') {
    painel.style.backgroundColor = '#f0fdf4';
    painel.style.color = '#15803d';
    painel.style.border = '1px solid #bbf7d0';
  } else {
    painel.style.backgroundColor = '#fef2f2';
    painel.style.color = '#991b1b';
    painel.style.border = '1px solid #fecaca';
  }
  painel.innerText = texto;
  setTimeout(() => painel.classList.add('hidden'), 4000);
}

/* ==========================================================================
   8. GRÁFICO (Chart.js - RF06)
   ========================================================================== */
function inicializarGrafico() {
  const ctx = document.getElementById('graficoHistorico').getContext('2d');

  graficoHistorico = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labelsHorario,
      datasets: [
        {
          label: 'Temperatura (°C)',
          data: dadosTemperatura,
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Umidade (%)',
          data: dadosUmidade,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: false, suggestedMin: 10, suggestedMax: 80 }
      },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 12, weight: 'bold' } } }
      }
    }
  });
}

function adicionarPontoAoGrafico(temp, umidade) {
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (labelsHorario.length >= maxPontosGrafico) {
    labelsHorario.shift();
    dadosTemperatura.shift();
    dadosUmidade.shift();
  }

  labelsHorario.push(hora);
  dadosTemperatura.push(temp);
  dadosUmidade.push(umidade);
  graficoHistorico.update();
}
