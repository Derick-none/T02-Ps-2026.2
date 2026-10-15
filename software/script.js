/* ==========================================================================
   1. VARIÁVEIS GLOBAIS DE ESTADO, LIMITES E GRÁFICO (RF06, RF08)
   ========================================================================== */
let modoOperacaoAtual = 'automatico'; // 'ligado', 'desligado', 'automatico'
let limiteTemperatura = 35.0;
let limiteUmidade = 70.0;
let graficoHistorico = null;

// Histórico de pontos para o gráfico (máximo de 10 medições)
const maxPontosGrafico = 10;
const labelsHorario = [];
const dadosTemperatura = [];
const dadosUmidade = [];

/* ==========================================================================
   2. INICIALIZAÇÃO DO DOM (QUANDO A PÁGINA CARREGA)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  inicializarGrafico();
  configurarEventosBotoesModo();
  configurarFormularioLimites();
  configurarLeituraSobDemanda();

  // Atualização periódica a cada 2 segundos (NF03)
  setInterval(buscarDadosDoServidor, 2000);
});

/* ==========================================================================
   3. SELEÇÃO DE MODO DE OPERAÇÃO E CONTROLE DE BOTÕES (RF03, RF04)
   ========================================================================== */
function configurarEventosBotoesModo() {
  const btnLigado = document.getElementById('btn-ligado');
  const btnDesligado = document.getElementById('btn-desligado');
  const btnAutomatico = document.getElementById('btn-automatico');

  btnLigado.addEventListener('click', () => alterarModoOperacao('ligado'));
  btnDesligado.addEventListener('click', () => alterarModoOperacao('desligado'));
  btnAutomatico.addEventListener('click', () => alterarModoOperacao('automatico'));
}

function alterarModoOperacao(novoModo) {
  modoOperacaoAtual = novoModo;

  // Atualiza o texto do modo ativo no painel
  const rotuloModo = novoModo === 'ligado' ? 'Ligado (Manual)' : novoModo.charAt(0).toUpperCase() + novoModo.slice(1);
  document.getElementById('modo-ativo').innerText = rotuloModo;

  // Atualiza o destaque visual (.ativo) dos botões
  document.querySelectorAll('.botoes-grupo .btn').forEach(btn => btn.classList.remove('ativo'));
  if (novoModo === 'ligado') document.getElementById('btn-ligado').classList.add('ativo');
  if (novoModo === 'desligado') document.getElementById('btn-desligado').classList.add('ativo');
  if (novoModo === 'automatico') document.getElementById('btn-automatico').classList.add('ativo');

  // Habilita/Desabilita o botão "Solicitar Nova Leitura" (exclusivo do Modo Ligado)
  const btnSolicitar = document.getElementById('btn-solicitar-leitura');
  btnSolicitar.disabled = (novoModo !== 'ligado');

  // Atualiza a indicação dos LEDs Azuis Físicos no dashboard
  atualizarIndicadoresLEDs(novoModo);

  // Envia a alteração de modo para o ESP32 via requisição HTTP
  fetch(`/api/modo?selecionado=${novoModo}`, { method: 'POST' })
    .catch(() => console.log(`[Simulador] Modo alterado localmente para: ${novoModo}`));
}

/* ==========================================================================
   4. LEITURA SOB DEMANDA (EXCLUSIVA DO MODO LIGADO)
   ========================================================================== */
function configurarLeituraSobDemanda() {
  const btnSolicitar = document.getElementById('btn-solicitar-leitura');

  btnSolicitar.addEventListener('click', () => {
    if (modoOperacaoAtual !== 'ligado') return;

    // Pisca o LED Azul 3 temporariamente para indicar a leitura sob demanda
    piscadoTemporarioLED3();

    // Solicita nova leitura ao ESP32 ou executa no simulador
    fetch('/api/leitura-demanda', { method: 'POST' })
      .then(res => res.json())
      .then(dados => processarLeituraValida(dados.temperatura, dados.umidade))
      .catch(() => {
        // Simulador sob demanda
        const tempSim = parseFloat((25 + Math.random() * 8).toFixed(1));
        const umidSim = parseFloat((55 + Math.random() * 15).toFixed(1));
        processarLeituraValida(tempSim, umidSim);
      });
  });
}

function piscadoTemporarioLED3() {
  const led3 = document.getElementById('led-azul-3');
  led3.className = 'led-indicador on';
  setTimeout(() => {
    if (modoOperacaoAtual !== 'ligado') led3.className = 'led-indicador off';
  }, 1000);
}

/* ==========================================================================
   5. ATUALIZAÇÃO DOS LEDS AZUIS FÍSICOS (FLUXOGRAMA DO ESP32)
   ========================================================================== */
function atualizarIndicadoresLEDs(modo) {
  const led1 = document.getElementById('led-azul-1'); // LED 1: Modo Desligado
  const led2 = document.getElementById('led-azul-2'); // LED 2: Modo Automático
  const led3 = document.getElementById('led-azul-3'); // LED 3: Leitura Sob Demanda (Modo Ligado)

  led1.className = (modo === 'desligado') ? 'led-indicador on' : 'led-indicador off';
  led2.className = (modo === 'automatico') ? 'led-indicador on' : 'led-indicador off';
  led3.className = (modo === 'ligado') ? 'led-indicador on' : 'led-indicador off';
}

/* ==========================================================================
   6. CONFIGURAÇÃO DOS LIMITES DE ALERTA (RF07, RF08)
   ========================================================================== */
function configurarFormularioLimites() {
  const form = document.getElementById('form-limites');
  const painelAlerta = document.getElementById('painel-alerta');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const tempInput = parseFloat(document.getElementById('limite-temp').value);
    const umidadeInput = parseFloat(document.getElementById('limite-umidade').value);

    if (!isNaN(tempInput) && !isNaN(umidadeInput)) {
      limiteTemperatura = tempInput;
      limiteUmidade = umidadeInput;

      painelAlerta.className = 'alerta-box';
      painelAlerta.style.backgroundColor = '#f0fdf4';
      painelAlerta.style.color = '#15803d';
      painelAlerta.style.border = '1px solid #bbf7d0';
      painelAlerta.innerText = `Limites salvos: Temp Máx = ${limiteTemperatura}°C | Umidade Máx = ${limiteUmidade}%`;
      painelAlerta.classList.remove('hidden');

      setTimeout(() => painelAlerta.classList.add('hidden'), 4000);
    }
  });
}

/* ==========================================================================
   7. CONSULTA DE DADOS E SIMULADOR LOCAL (RF02, RF05, NF02, NF03)
   ========================================================================== */
function buscarDadosDoServidor() {
  // Se estiver no Modo Desligado, suspende novas leituras conforme o fluxograma
  if (modoOperacaoAtual === 'desligado') {
    atualizarInterfaceComValores('--', '--', 'Aquisição de Dados Suspensa (Modo Desligado)', false);
    atualizarStatusRede(true, '192.168.1.100 (ESP32)');
    return;
  }

  // Se estiver no Modo Ligado, as leituras são feitas sob demanda (botão)
  if (modoOperacaoAtual === 'ligado') {
    atualizarStatusRede(true, '192.168.1.100 (ESP32)');
    return;
  }

  // Modo Automático: Consulta periódica à API do ESP32
  fetch('/api/dados')
    .then(resposta => {
      if (!resposta.ok) throw new Error("Erro na rede");
      return resposta.json();
    })
    .then(dados => {
      atualizarStatusRede(dados.wifi_conectado, dados.ip || '192.168.1.100');
      processarLeituraValida(dados.temperatura, dados.umidade);
    })
    .catch(() => {
      // Fallback: Simulador local para testes no navegador
      gerarDadosSimuladosLocais();
    });
}

function gerarDadosSimuladosLocais() {
  atualizarStatusRede(false, '127.0.0.1 (Simulador Local)');

  const tempSimulada = parseFloat((24 + Math.random() * 14).toFixed(1));
  const umidadeSimulada = parseFloat((50 + Math.random() * 25).toFixed(1));

  processarLeituraValida(tempSimulada, umidadeSimulada);
}

function atualizarStatusRede(conectado, ip) {
  const elWifi = document.getElementById('wifi-status');
  const elIp = document.getElementById('esp-ip');

  if (conectado) {
    elWifi.innerText = 'Conectado (OK)';
    elWifi.style.color = '#4ade80'; // Verde
    elIp.innerText = ip;
  } else {
    elWifi.innerText = 'Desconectado (Modo Offline/Simulado)';
    elWifi.style.color = '#f87171'; // Vermelho
    elIp.innerText = ip;
  }
}

function processarLeituraValida(temp, umidade) {
  let statusTexto = 'Leitura OK (Dados Atualizados)';
  let emAlerta = false;

  // Verificação dos Limites de Alerta no Modo Automático (RF07)
  if (modoOperacaoAtual === 'automatico') {
    if (temp > limiteTemperatura || umidade > limiteUmidade) {
      statusTexto = 'ALERTA: Limite Excedido!';
      emAlerta = true;
    }
  }

  atualizarInterfaceComValores(temp, umidade, statusTexto, emAlerta);
  adicionarPontoAoGrafico(temp, umidade);
}

function atualizarInterfaceComValores(temp, umidade, statusTexto, emAlerta) {
  const elTemp = document.getElementById('temp-valor');
  const elUmidade = document.getElementById('umidade-valor');
  const elStatus = document.getElementById('status-sensor');

  elTemp.innerText = typeof temp === 'number' ? temp.toFixed(1) : temp;
  elUmidade.innerText = typeof umidade === 'number' ? umidade.toFixed(1) : umidade;
  elStatus.innerText = statusTexto;

  if (emAlerta) {
    elStatus.style.color = '#ef4444';
  } else if (statusTexto.includes('Suspensa') || statusTexto.includes('Aguardando')) {
    elStatus.style.color = '#64748b';
  } else {
    elStatus.style.color = '#15803d';
  }
}

/* ==========================================================================
   8. CONSTRUÇÃO E ATUALIZAÇÃO DO GRÁFICO (Chart.js - RF06)
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
        y: {
          beginAtZero: false,
          suggestedMin: 10,
          suggestedMax: 80
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12, weight: 'bold' } }
        }
      }
    }
  });
}

function adicionarPontoAoGrafico(temp, umidade) {
  if (typeof temp !== 'number' || typeof umidade !== 'number') return;

  const agora = new Date();
  const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (labelsHorario.length >= maxPontosGrafico) {
    labelsHorario.shift();
    dadosTemperatura.shift();
    dadosUmidade.shift();
  }

  labelsHorario.push(horaFormatada);
  dadosTemperatura.push(temp);
  dadosUmidade.push(umidade);

  graficoHistorico.update();
}