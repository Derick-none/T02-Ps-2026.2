
#include <Arduino.h>
#include <DHT.h>
#include <WiFi.h>

// Credenciais Wi-Fi
const char* nomeRede = "NOME_DA_SUA_REDE";
const char* senhaRede = "SENHA_DA_SUA_REDE";

// Sensor DHT11
const int pinDHT = 14;
#define TIPO_DHT DHT11

DHT dht(pinDHT, TIPO_DHT);

// Dados mantidos na memoria RAM
struct InfoSensor {
    float temperatura = 0.0f;
    float umidade = 0.0f;

    bool sensorEstado = false;
    bool leituraSensor = false;
};

InfoSensor sensor;

// Controle de leitura do sensor
unsigned long ultimaLeitura = 0;
const unsigned long intervaloLeitura = 2000;

// Controle do Wi-Fi
unsigned long ultimaTentativaWiFi = 0;
const unsigned long intervaloReconexao = 5000;

bool wifiEstavaConectado = false;

void gerenciarWiFi() {
    bool conectado = (WiFi.status() == WL_CONNECTED);

    if (conectado && !wifiEstavaConectado) {
        Serial.println("Wi-Fi conectado!");

        Serial.print("Endereco IP: ");
        Serial.println(WiFi.localIP());
    }

    if (!conectado && wifiEstavaConectado) {
        Serial.println("Wi-Fi desconectado!");
        Serial.println("Sensor continua funcionando localmente.");
    }

    wifiEstavaConectado = conectado;

    unsigned long agora = millis();

    if (!conectado &&
        agora - ultimaTentativaWiFi >= intervaloReconexao) {

        ultimaTentativaWiFi = agora;

        Serial.println("Tentando reconectar ao Wi-Fi...");
        WiFi.reconnect();
    }
}

void setup() {
    Serial.begin(115200);

    dht.begin();

    Serial.println("Monitoramento ambiental");
    Serial.println("DHT11 inicializado");

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(nomeRede, senhaRede);

    Serial.println("Tentando conectar ao Wi-Fi...");
}

void loop() {
    // Gerencia a rede sem esperar a conexao
    gerenciarWiFi();

    // Le o sensor no intervalo definido
    unsigned long agora = millis();

    if (agora - ultimaLeitura >= intervaloLeitura) {
        ultimaLeitura = agora;

        float temperatura = dht.readTemperature();
        float umidade = dht.readHumidity();

        if (isnan(temperatura) || isnan(umidade)) {
            sensor.sensorEstado = false;
            sensor.leituraSensor = false;

            Serial.println("Erro ao ler o DHT11");
        } else {
            sensor.temperatura = temperatura;
            sensor.umidade = umidade;

            sensor.sensorEstado = true;
            sensor.leituraSensor = true;

            Serial.println("---------------");

            Serial.print("Temperatura: ");
            Serial.print(sensor.temperatura);
            Serial.println(" C");

            Serial.print("Umidade: ");
            Serial.print(sensor.umidade);
            Serial.println(" %");

            Serial.println("---------------");
        }
    }
}
