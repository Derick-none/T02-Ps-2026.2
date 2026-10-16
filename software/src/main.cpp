#include <Arduino.h>
#include <DHT.h>
#include <WiFi.h>
#include <LittleFS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>


// Configurando sensor
const int pinDHT = 14; // Pino usado para o sensor
#define TIPO_DHT DHT11
DHT dht(pinDHT, TIPO_DHT);

//Configurando LEDs
const int pinLedDesligado = 32; //LED 1 no site  
const int pinLedAutomatico = 33;  //LED 2 no site
const int pinLedLigado = 27; // LED 3 no site

// Configurando WiFi
const char* nomeWifi = "Paty"; // Nome da rede que está usando
const char* senhaWifi = "16111951"; // Senha da rede 

unsigned long ultimaTentativaWiFi = 0; // Variavel para armazenar o tempo da ultima tentativa de reconexao
const unsigned long intervaloReconexao = 5000; // Intervalo de tempo entre as tentativas de reconexao
bool wifiEstavaConectado = false; // Variavel para armazenar o estado da conexao WiFi

const int MODO_DESLIGADO = 0; 
const int MODO_LIGADO = 1; 
const int MODO_AUTOMATICO = 2; 

// Dados para guarda na memoria RAM
struct InfoSensor {
  float temperatura = 0.0f;
  float umidade = 0.0f;
  
  bool sensorEstado = false; // true = sensor funcionando, false = sensor com problema
  bool leituraSensor = false; // true = leitura realizada, false = leitura não realizada
};

/*Toda vez que quero acessar os dados do sensor, basta chamar "sensor"*/
InfoSensor sensor;

volatile int  modoAtual = MODO_AUTOMATICO; // Variavel para armazenar o modo atual do sistema
volatile bool leituraSolicitada = false; // Variavel para armazenar se a leitura foi solicitada pelo usuario
volatile bool lerImediatamente = false; // Variavel para armazenar se a leitura deve ser realizada imediatamente (sem esperar o intervalo)

/*Casos base, quando inicializar*/
float limiteTemperatura = 67.67f; 
float limiteUmidade = 38.38f; 
bool emAlerta = false; /*Já começa sem alerta*/

unsigned long ultimaLeitura = 0;
const unsigned long intervaloLeitura = 2000; // Nunca menor que 2 seg, por causa do sensor

AsyncWebServer server(80);

/*Converte o numero do modo para o texto, assim o site entende*/
/*Tem que ser em minusculo, pq e assim que o json espera*/
String textoDoModo(int modo) {
	if (modo == MODO_LIGADO){
		return "ligado";
	}
	else if (modo == MODO_AUTOMATICO){
		return "automatico";
	}
	else{
		return "desligado";
	}
}

/*Aqui muda o valor booleando para um string*/
String textoBool(bool valor) {
	if (valor == true){
		return "true";
	}
	return "false";
}

void aplicarModo(int novoModo){
	modoAtual = novoModo;

	sensor.leituraSensor = false;
	emAlerta = false;
	leituraSolicitada = false;

	lerImediatamente = false;
	if(novoModo == MODO_AUTOMATICO){
		lerImediatamente = true;
	}

	Serial.print("Modo alterado para: ");
	Serial.println(textoDoModo(novoModo));
}

void atualizarLED(){
	if(modoAtual == MODO_DESLIGADO){
		digitalWrite(pinLedDesligado, HIGH);
		digitalWrite(pinLedAutomatico, LOW);
		digitalWrite(pinLedLigado, LOW);
	}
	else if(modoAtual == MODO_AUTOMATICO){
		digitalWrite(pinLedDesligado, LOW);
		digitalWrite(pinLedAutomatico, HIGH);
		digitalWrite(pinLedLigado, LOW);
	}
	else if(modoAtual == MODO_LIGADO){
		digitalWrite(pinLedDesligado, LOW);
		digitalWrite(pinLedAutomatico, LOW);
		digitalWrite(pinLedLigado, HIGH);
	}
}

/*Compara a ultima leitura com os limites, pra avisar o alerta*/
void verificarAlerta(){
	emAlerta = false; 

	if (sensor.temperatura > limiteTemperatura){
		emAlerta = true;
	}
	if(sensor.umidade > limiteUmidade){
		emAlerta = true;
	}
}

void lerSensor(){
	float temperatura = dht.readTemperature();
	float umidade = dht.readHumidity();

	/*isnan() = is Not a Number, ele fala se a leitura e invalida do sensor*/
	if(isnan(temperatura) || isnan(umidade)){
		sensor.sensorEstado = false;
		sensor.leituraSensor = false;
		emAlerta = false;
		Serial.println("Erro ao ler o DHT11");
		return;
	}

	// Leitura valida: guarda nas variaveis globais
  sensor.temperatura = temperatura;
  sensor.umidade = umidade;
  sensor.sensorEstado = true;
  sensor.leituraSensor = true;

  verificarAlerta();

  Serial.print("Temperatura: ");
  Serial.print(temperatura);
  Serial.print(" C | Umidade: ");
  Serial.print(umidade);
  Serial.print(" % | Alerta: ");
  if (emAlerta == true) {
    Serial.println("SIM");
  } else {
    Serial.println("nao");
  }
}



String construirJason(){
	bool conectado = false;
	if(WiFi.status() == WL_CONNECTED){
		conectado = true;
	}

	bool alertaAtivo = false;
	if(modoAtual == MODO_AUTOMATICO && emAlerta == true){
		alertaAtivo = true;

	}

	String json = "{";

	/*--Essa parte vê se os sensores respodem e avisa o json do site --*/
	json += "\"temperatura\":";
	if(sensor.leituraSensor == true){
		json += String(sensor.temperatura, 1);
	}
	else{
		json += "null";
	}

	json += ",\"umidade\":";
	if(sensor.leituraSensor == true){
		json += String(sensor.umidade, 1);
	}
	else{
		json += "null";
	}
	/*-- Daqui pra baixo agora são só as informações do jason*/

	json += ",\"sensorEstado\":";
	json += textoBool(sensor.sensorEstado);

	json += ",\"leituraSensor\":";
	json += textoBool(sensor.leituraSensor); 

	json += ",\"modo\":\""; /*Essa barra abre aqui*/
	json += textoDoModo(modoAtual);

	//Fecha a barra do modoAtula que abrimos 
	json += "\""; /*ERA SÓ ISSO !!!!!!!!!*/

	json += ",\"alerta\":";
	json += textoBool(alertaAtivo);

	json += ",\"limiteTemperatura\":";
	json += String(limiteTemperatura, 1);

	json += ",\"limiteUmidade\":";
	json += String(limiteUmidade, 1);

	json += ",\"wifi_conectado\":";
	json += textoBool(conectado); 

	json += ",\"ip\":\"";
	json += WiFi.localIP().toString();
	json += "\"";
	json += "}";

	return json;
}


void gerenciarWiFi(){
	bool conectado = false;
	if(WiFi.status() == WL_CONNECTED){
		conectado = true;
	}

	if(conectado == true && wifiEstavaConectado == false){
		Serial.println("Wifi conectado");
		Serial.print("Endereço IP: ");
		Serial.println(WiFi.localIP());
	}

	if(conectado == false && wifiEstavaConectado == true){
		Serial.println("Wifi desconectado");
		Serial.println("Sensor continua funcionando localmente");
	}

	wifiEstavaConectado = conectado;

	unsigned long agora = millis();

	if(conectado == false && agora - ultimaTentativaWiFi >= intervaloReconexao){
		
		ultimaTentativaWiFi = agora;

		Serial.println("Tentando reconectar ao WiFi...");
		WiFi.reconnect();
	}
}


/*Rotas bagulho chato >:(*/

void tratarDados(AsyncWebServerRequest *request) {
request->send(200, "application/json", construirJason());
}

// POST /api/modo?selecionado=ligado|desligado|automatico
void tratarModo(AsyncWebServerRequest *request) {
  // O parametro veio no pedido?
  if (request->hasParam("selecionado") == false) {
    request->send(400, "application/json", "{\"erro\":\"parametro selecionado ausente\"}");
    return;
  }

  String modoTexto = request->getParam("selecionado")->value();

  if (modoTexto == "ligado") {
    aplicarModo(MODO_LIGADO);
  }
  else if (modoTexto == "desligado") {
    aplicarModo(MODO_DESLIGADO);
  }
  else if (modoTexto == "automatico") {
    aplicarModo(MODO_AUTOMATICO);
  }
  else {
    request->send(400, "application/json", "{\"erro\":\"modo invalido\"}");
    return;
  }

  request->send(200, "application/json", construirJason());
}

// POST /api/leitura-demanda
// Este tratador NAO le o sensor. Ele so levanta uma "bandeira" (flag).
// Quem le o sensor e o loop(), que enxerga a bandeira e faz o trabalho.
void tratarLeituraDemanda(AsyncWebServerRequest *request) {
  if (modoAtual != MODO_LIGADO) {
    request->send(409, "application/json", "{\"erro\":\"disponivel apenas no modo ligado\"}");
    return;
  }

  leituraSolicitada = true;
  request->send(202, "application/json", "{\"aceito\":true}");
}

// POST /api/limites?temp=35.0&umid=70.0
void tratarLimites(AsyncWebServerRequest *request) {
  if (request->hasParam("temp") == false || request->hasParam("umid") == false) {
    request->send(400, "application/json", "{\"erro\":\"informe temp e umid\"}");
    return;
  }

  limiteTemperatura = request->getParam("temp")->value().toFloat();
  limiteUmidade = request->getParam("umid")->value().toFloat();

  Serial.print("Novos limites: ");
  Serial.print(limiteTemperatura);
  Serial.print(" C | ");
  Serial.print(limiteUmidade);
  Serial.println(" %");

  request->send(200, "application/json", construirJason());
}

void tratarNaoEncontrado(AsyncWebServerRequest *request) {
  request->send(404, "text/plain", "Nao encontrado");
}

/*-------Fim da parte chata-------*/

void configurarAPI() {
	server.on("/api/dados", HTTP_GET, tratarDados);
	server.on("/api/modo", HTTP_POST, tratarModo);
	server.on("/api/leitura-demanda", HTTP_POST, tratarLeituraDemanda);
	server.on("/api/limites", HTTP_POST, tratarLimites);
	
	/*Entrega o front gravados no LittleFS (A pasta "data") */
	server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
	server.onNotFound(tratarNaoEncontrado);
	server.begin();
	Serial.println("Servidor iniciado");
}

void setup() {
	Serial.begin(115200);

  pinMode(pinLedDesligado, OUTPUT);
  pinMode(pinLedAutomatico, OUTPUT);
  pinMode(pinLedLigado, OUTPUT);
  atualizarLED();

  // true = formata a memoria se for a primeira vez
  if (LittleFS.begin(true) == false) {
    Serial.println("ERRO: falha ao montar LittleFS");
  }

	dht.begin(); // Ligando o sensor
	Serial.println("Monitoramento ambiental");
	Serial.println("DHT inicializado");

	WiFi.mode(WIFI_STA);
	WiFi.setAutoReconnect(true);
	WiFi.begin(nomeWifi, senhaWifi);
	Serial.println("Tentando conectar ao WiFi...");

	configurarAPI();
}


void loop() {
	
	gerenciarWiFi();
	atualizarLED();

	unsigned long agora  = millis();

	if (modoAtual == MODO_AUTOMATICO) {
    // Le a cada 2 segundos, ou imediatamente se alguem pediu
    bool passouIntervalo = (agora - ultimaLeitura >= intervaloLeitura);

    if (passouIntervalo == true || lerImediatamente == true) {
      ultimaLeitura = agora;
      lerImediatamente = false;
      lerSensor();
    }
  }
  else if (modoAtual == MODO_LIGADO) {
    // Le somente quando o usuario clicou no botao
    if (leituraSolicitada == true) {
      leituraSolicitada = false;
      lerSensor();
    }
  }
}
