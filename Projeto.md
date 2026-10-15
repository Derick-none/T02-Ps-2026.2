#Cliente
Trata-se de um projeto de monitoramento ambiental utilizando um sensor de tempe-
ratura e umidade e um microcontrolador. Requisito principal: o sistema deve coletar
dados de temperatura e umidade do ambiente e disponibilizá-los em tempo real via
interface web. Além disso, o sistema deve permitir que o usuário alterne entre modos
de operação por meio da interface web, com indicação visual do modo ativo através de
LEDs.

## Requisitos funcionais
- **RF01:** O sistema deve coletar a temperatura e a umidade do ambiente usando o sensor conectado ao microcontrolador (Essencial).
- **RF02:** A interface web deve exibir os valores mais recentes de temperatura e umidade, com suas respectivas unidades (temperatura = Grau celsius | umidade = %). (Essencial)
- **RF03:** O usuário deve poder selecionar, pela interface web, os modos desligado, automático e ligado atráves de botões na interface.(Essencial)
- **RF04:** No modo automático, o sistema deve realizar e exibir leituras continuamente; no modo ligado, deve permanecer ativo aguardando uma ação do usuário. (Essencial)
- **RF05:** Os LEDs do hardware devem indicar o modo selecionado, e o modo desligado deve desativar o sensor e a coleta de dados.(Essencial)
- **RF06:** A interface web deve informar qual modo de operação está ativo no momento. (Importante)
- **RF07:** O sistema deve registrar as leituras com data e hora e permitir que o usuário consulte o histórico durante a execução.(Desejavel)
- **RF08:** O usuário deve poder configurar limites de temperatura e umidade, e o sistema deve sinalizar quando uma leitura ultrapassar esses limites. (Desejavel)
- **RF09:** A interface web deve informar se o sensor está conectado e se a comunicação com o microcontrolador está disponível. (Importante)

## Requisitos não funcionais
- **RNF01:** A comunicação entre o microcontrolador e a interface web deve ocorrer por meio de uma rede.
- **RNF02:** A interface deve atualizar as leituras sem exigir que o usuário recarregue a página.
- **RNF03:** Se houver falha na leitura do sensor ou na comunicação, a interface deve informar que os dados estão indisponíveis, em vez de apresentá-los como atuais.
- **RNF04:** Após uma leitura ser recebida pelo microcontrolador, a interface deve exibi-la em até 2 segundos, sem necessidade de recarregar a página.
- **RNF05:** O site deve responder a mudança da temperatura em +/- 500 milisegundos. 

#Disciplinas
##Eletrônica
Os trainees deverão realizar uma pesquisa para selecionar um sensor de tempera-
tura e umidade adequado para o projeto, bem como um microcontrolador capaz de
alimentar o sensor e executar a lógica do sistema. O microcontrolador deve ser capaz
de se comunicar com a interface web e controlar os LEDs indicadores de modo. Os
trainees devem justificar suas escolhas com base em características técnicas relevan-
tes, como faixa de medição, precisão, consumo de energia, facilidade de programação
e suporte a comunicação via rede.
Os componentes do protótipo terão de ser soldados em uma placa perfurada.
##Software
O software terá três modos de operação: desligado (onde o sensor e o sistema são
desativados), automático (onde o sistema coleta e exibe os dados continuamente de
forma automática) e ligado (onde o sistema opera normalmente aguardando ação do
usuário). A interface web deverá exibir os dados de temperatura e umidade em tempo
real e disponibilizar botões para alternância entre os modos de operação. Ao mudar o
modo pela interface, os LEDs do hardware devem refletir a mudança, acendendo ou
apagando conforme o estado atual (ligado, automático ou desligado).
