document.addEventListener('DOMContentLoaded', () => {
    const cableArea = document.getElementById('cable-area');
    const cableImg = document.getElementById('cable-img');
    const strippedWiresContainer = document.getElementById('stripped-wires');
    const rj45Connector = document.getElementById('rj45-connector');
    const pinSlots = document.querySelectorAll('.pin-slot');
    const toolStripper = document.getElementById('tool-stripper');
    const toolCrimper = document.getElementById('tool-crimper');
    const toolCut = document.getElementById('tool-cut');
    const toolUntwist = document.getElementById('tool-untwist');
    const currentInstruction = document.getElementById('current-instruction');
    const feedbackMessage = document.getElementById('feedback-message');
    const selectT568AButton = document.getElementById('select-t568a');
    const selectT568BButton = document.getElementById('select-t568b');
    const selectCrossoverButton = document.getElementById('select-crossover');
    const testButton = document.getElementById('test-button');
    const testerLights = document.querySelectorAll('.tester-lights .light');
    const testerMessage = document.getElementById('tester-message');
    const resetButton = document.getElementById('reset-button');

    const welcomeModal = document.getElementById('welcome-modal');
    const startSimulationButton = document.getElementById('start-simulation-button');

    // Sons
    const stripSound = document.getElementById('strip-sound');
    const crimpSound = document.getElementById('crimp-sound');
    const errorSound = document.getElementById('error-sound');
    const successSound = document.getElementById('success-sound');
    const dragSound = document.getElementById('drag-sound');
    const cutSound = document.getElementById('cut-sound');
    const untwistSound = document.getElementById('untwist-sound');

    let currentPattern = null;
    let currentTool = null;
    let currentStep = 0;
    let wiresOrder = new Array(8).fill(null);
    let cableCrimped = false;
    let dragOriginWire = null; // Para arrastar do mouse
    let touchDragGhost = null; // Para o elemento "fantasma" no toque
    let touchDragTargetWire = null; // O fio real que está sendo arrastado no toque

    // Definição dos padrões de cores
    const patterns = {
        'T568A': ['verde-branco', 'verde', 'laranja-branco', 'azul', 'azul-branco', 'laranja', 'marrom-branco', 'marrom'],
        'T568B': ['laranja-branco', 'laranja', 'verde-branco', 'azul', 'azul-branco', 'verde', 'marrom-branco', 'marrom'],
        'Crossover': {
            'end1': ['laranja-branco', 'laranja', 'verde-branco', 'azul', 'azul-branco', 'verde', 'marrom-branco', 'marrom'],
            'end2': ['verde-branco', 'verde', 'laranja-branco', 'azul', 'azul-branco', 'laranja', 'marrom-branco', 'marrom']
        }
    };

    // Mapeamento de cores para imagens
    const wireImages = {
        'verde-branco': 'js/assets/wire_green_white.png',
        'verde': 'js/assets/wire_green.png',
        'laranja-branco': 'js/assets/wire_orange_white.png',
        'laranja': 'js/assets/wire_orange.png',
        'azul-branco': 'js/assets/wire_blue_white.png',
        'azul': 'js/assets/wire_blue.png',
        'marrom-branco': 'js/assets/wire_brown_white.png',
        'marrom': 'js/assets/wire_brown.png',
    };

    // --- Funções de UI e Feedback ---
    function updateInstructions(message) {
        currentInstruction.innerHTML = message;
    }

    function showFeedback(message, isError = false) {
        feedbackMessage.textContent = message;
        feedbackMessage.style.backgroundColor = isError ? 'rgba(220, 53, 69, 0.85)' : 'rgba(40, 167, 69, 0.85)';
        feedbackMessage.style.display = 'block';
        if (isError) {
            errorSound.play();
        } else {
            successSound.play();
        }
        setTimeout(() => {
            feedbackMessage.style.display = 'none';
        }, 3000);
    }

    function highlightTarget(elementId, add = true) {
        const element = document.getElementById(elementId);
        if (element) {
            if (add) {
                element.classList.add('highlight');
            } else {
                element.classList.remove('highlight');
            }
        }
    }

    function enableTool(toolElement, enable = true) {
        if (enable) {
            toolElement.classList.add('enabled');
        } else {
            toolElement.classList.remove('enabled');
            toolElement.classList.remove('active');
        }
    }

    function selectTool(toolElement, toolName) {
        if (!toolElement.classList.contains('enabled')) {
            showFeedback('Esta ferramenta não está disponível agora.', true);
            return false;
        }
        if (currentTool) {
            document.getElementById(`tool-${currentTool}`).classList.remove('active');
        }
        currentTool = toolName;
        toolElement.classList.add('active');
        return true;
    }

    // --- Fluxo de Passos ---
    const simulatorSteps = [
        {
            instruction: 'Bem-vindo ao Simulador de Crimpagem! Para começar, selecione o padrão de crimpagem desejado.',
            highlight: null,
            requiredAction: 'selectPattern',
            availableTools: []
        },
        {
            instruction: 'Padrão **[PADRAO]** selecionado. Agora, **selecione o Decapador** na caixa de ferramentas.',
            highlight: 'tool-stripper',
            requiredAction: 'selectStripper',
            availableTools: ['stripper']
        },
        {
            instruction: 'Decapador selecionado. **Clique no cabo UTP** na área de trabalho para remover a capa externa.',
            highlight: 'cable-area',
            requiredAction: 'stripCable',
            availableTools: ['stripper']
        },
        {
            instruction: 'Cabo desencapado! Agora, **selecione o Desentrançador** e clique na área dos fios para separá-los.',
            highlight: 'tool-untwist',
            requiredAction: 'untwistWires',
            availableTools: ['untwist']
        },
        {
            instruction: 'Fios desentrançados! Agora, **selecione o Cortador de Fios** e clique na área dos fios para alinhar as pontas.',
            highlight: 'tool-cut',
            requiredAction: 'cutWires',
            availableTools: ['cut']
        },
        {
            instruction: 'Fios cortados e alinhados! Agora, **arraste os fios** um por um para os slots do conector RJ45 na **ordem correta** do padrão escolhido. Use os nomes abaixo dos fios para ajudar! **Dica: Duplo clique ou toque duplo em um fio no RJ45 para removê-lo e corrigir.**',
            highlight: 'rj45-connector',
            requiredAction: 'dragWires',
            availableTools: []
        },
        {
            instruction: 'Todos os fios estão nos slots! Agora, **selecione o Alicate de Crimpar** e clique no **Conector RJ45** para crimpar o cabo.',
            highlight: 'tool-crimper',
            requiredAction: 'crimpCable',
            availableTools: ['crimper']
        },
        {
            instruction: 'Ótimo! Seu cabo está crimpado. Agora, **clique no botão "Testar Cabo"** no testador para verificar a conexão.',
            highlight: 'cable-tester',
            requiredAction: 'testCable',
            availableTools: []
        },
        {
            instruction: 'Cabo testado. Para uma nova tentativa, clique em **Reiniciar Simulação**.',
            highlight: null,
            requiredAction: null,
            availableTools: []
        }
    ];

    function goToStep(stepNum) {
        currentStep = stepNum;
        const step = simulatorSteps[currentStep];

        let instructionText = step.instruction;
        if (currentStep === 1 && currentPattern) {
            instructionText = instructionText.replace('[PADRAO]', currentPattern);
        }
        updateInstructions(instructionText);

        document.querySelectorAll('.step-target.highlight, .tool.active, .tool.highlight').forEach(el => el.classList.remove('highlight', 'active'));
        enableTool(toolStripper, false);
        enableTool(toolUntwist, false);
        enableTool(toolCut, false);
        enableTool(toolCrimper, false);

        step.availableTools.forEach(toolName => {
            const toolElement = document.getElementById(`tool-${toolName}`);
            if (toolElement) {
                enableTool(toolElement, true);
            }
        });

        if (step.highlight) {
            highlightTarget(step.highlight, true);
        }

        // Controla o estado de arrastável dos fios (mouse e touch)
        if (step.requiredAction === 'dragWires') {
            document.querySelectorAll('#stripped-wires .wire').forEach(wire => {
                wire.classList.add('draggable');
            });
            pinSlots.forEach(slot => slot.classList.add('highlight-drop'));
        } else {
            document.querySelectorAll('#stripped-wires .wire').forEach(wire => {
                wire.classList.remove('draggable');
            });
            pinSlots.forEach(slot => slot.classList.remove('highlight-drop'));
        }

        testButton.disabled = !(currentStep === 7);
    }

    // --- Funções de Ação do Simulador ---

    // Event listener para o botão "Começar Simulação" do modal
    startSimulationButton.addEventListener('click', () => {
        welcomeModal.style.display = 'none'; // Esconde o modal
        goToStep(0); // Inicia o simulador no passo 0
    });

    selectT568AButton.addEventListener('click', () => {
        if (currentStep === 0) {
            currentPattern = 'T568A';
            goToStep(1);
            // Desabilita botões de padrão após seleção
            selectT568AButton.disabled = true;
            selectT568BButton.disabled = true;
            selectCrossoverButton.disabled = true;
        }
    });

    selectT568BButton.addEventListener('click', () => {
        if (currentStep === 0) {
            currentPattern = 'T568B';
            goToStep(1);
            selectT568AButton.disabled = true;
            selectT568BButton.disabled = true;
            selectCrossoverButton.disabled = true;
        }
    });

    selectCrossoverButton.addEventListener('click', () => {
        if (currentStep === 0) {
            currentPattern = 'Crossover';
            goToStep(1);
            selectT568AButton.disabled = true;
            selectT568BButton.disabled = true;
            selectCrossoverButton.disabled = true;
        }
    });

    // 2. Decapar o Cabo
    toolStripper.addEventListener('click', () => {
        if (currentStep === 1 && selectTool(toolStripper, 'stripper')) {
            goToStep(2);
        } else if (currentStep === 2 && currentTool === 'stripper') {
             showFeedback('Clique no cabo UTP para decapar.', true);
        } else if (currentStep > 2 && currentTool === 'stripper') {
            showFeedback('O cabo já foi desencapado.', false);
        } else if (currentStep < 2 && currentStep !== 0) {
            showFeedback('Selecione o decapador para o próximo passo.', true);
        } else if (currentStep === 0) {
             showFeedback('Selecione um padrão de crimpagem primeiro.', true);
        }
    });

    cableArea.addEventListener('click', () => {
        if (currentStep === 2 && currentTool === 'stripper') {
            cableImg.classList.add('hidden'); // Esconde a imagem do cabo inteiro
            strippedWiresContainer.style.backgroundImage = 'url(js/assets/stripped_cable_twisted.png)'; // Mostra o cabo desencapado mas trançado
            strippedWiresContainer.classList.add('visible'); // Torna a área visível
            strippedWiresContainer.innerHTML = ''; // Garante que não há fios individuais ainda
            stripSound.play();
            showFeedback('Cabo desencapado com sucesso!');
            goToStep(3); // Próximo passo: desentrançar
        } else if (currentStep === 2 && currentTool !== 'stripper') {
             showFeedback('Selecione o **decapador** para remover a capa do cabo.', true);
        } else if (currentStep > 2 && currentTool === 'stripper') {
            showFeedback('O cabo já foi desencapado.', false);
        }
    });

    // Função para criar os elementos dos fios (drag-and-drop)
    function createIndividualWires() {
        const initialWireOrder = [
            'laranja-branco', 'laranja', 'verde-branco', 'azul',
            'azul-branco', 'verde', 'marrom-branco', 'marrom'
        ];

        strippedWiresContainer.innerHTML = ''; // Limpa antes de criar
        strippedWiresContainer.style.display = 'flex'; // Garante que o flexbox esteja ativo para os fios

        initialWireOrder.forEach(color => {
            const wireContainer = document.createElement('div');
            wireContainer.classList.add('wire');
            wireContainer.draggable = true; // Habilita o drag normal para mouse
            wireContainer.dataset.color = color;

            const wireImg = document.createElement('img');
            wireImg.src = wireImages[color];
            wireImg.alt = color;
            wireContainer.appendChild(wireImg);

            const wireName = document.createElement('span');
            wireName.classList.add('wire-name');
            wireName.textContent = color.replace('-', ' ');
            wireContainer.appendChild(wireName);

            // --- Eventos de TOQUE para Drag & Drop em Mobile ---
            let initialX, initialY;
            let currentWireGhost = null; // Fantasma para o toque

            wireContainer.addEventListener('touchstart', (e) => {
                if (currentStep === 5 && wireContainer.classList.contains('draggable')) {
                    e.preventDefault(); // Previne scroll da página
                    initialX = e.touches[0].clientX;
                    initialY = e.touches[0].clientY;
                    touchDragTargetWire = wireContainer; // O fio real que estamos arrastando

                    // Cria o elemento fantasma
                    touchDragGhost = wireContainer.cloneNode(true);
                    touchDragGhost.classList.add('touch-drag-ghost');
                    touchDragGhost.style.position = 'fixed';
                    touchDragGhost.style.left = initialX + 'px';
                    touchDragGhost.style.top = initialY + 'px';
                    touchDragGhost.style.transform = 'translate(-50%, -50%)'; // Centraliza
                    document.body.appendChild(touchDragGhost);

                    wireContainer.style.opacity = '0.1'; // Esconde o original
                    dragSound.currentTime = 0;
                    dragSound.play();
                } else {
                    showFeedback('Ainda não é hora de arrastar os fios. Siga as instruções!', true);
                }
            }, { passive: false }); // `passive: false` para permitir e.preventDefault()

            wireContainer.addEventListener('touchmove', (e) => {
                if (touchDragGhost) {
                    e.preventDefault(); // Previne scroll da página
                    touchDragGhost.style.left = e.touches[0].clientX + 'px';
                    touchDragGhost.style.top = e.touches[0].clientY + 'px';

                    // Opcional: Adicionar feedback visual nos pin-slots durante o arrastar por toque
                    pinSlots.forEach(slot => {
                        const slotRect = slot.getBoundingClientRect();
                        const ghostRect = touchDragGhost.getBoundingClientRect();
                        if (
                            ghostRect.left < slotRect.right &&
                            ghostRect.right > slotRect.left &&
                            ghostRect.top < slotRect.bottom &&
                            ghostRect.bottom > slotRect.top
                        ) {
                            slot.style.backgroundColor = '#e0f0ff';
                        } else {
                             if (!slot.classList.contains('filled')) {
                                slot.style.backgroundColor = '#f9f9f9';
                            }
                        }
                    });
                }
            }, { passive: false });

            wireContainer.addEventListener('touchend', (e) => {
                if (touchDragGhost) {
                    document.body.removeChild(touchDragGhost);
                    touchDragGhost = null;

                    if (touchDragTargetWire) {
                        touchDragTargetWire.style.opacity = '1'; // Restaura opacidade do original

                        // Determina onde o fio foi "solto"
                        let dropped = false;
                        pinSlots.forEach(slot => {
                            const slotRect = slot.getBoundingClientRect();
                            const touchX = e.changedTouches[0].clientX;
                            const touchY = e.changedTouches[0].clientY;

                            if (
                                touchX > slotRect.left &&
                                touchX < slotRect.right &&
                                touchY > slotRect.top &&
                                touchY < slotRect.bottom
                            ) {
                                // Se tocou em um slot, tenta a lógica de drop
                                const targetPin = parseInt(slot.dataset.pin) - 1;
                                const color = touchDragTargetWire.dataset.color; // Pega a cor do fio real

                                if (currentStep === 5) {
                                    if (wiresOrder[targetPin] === null) {
                                        const wireImg = document.createElement('img');
                                        wireImg.src = wireImages[color];
                                        wireImg.classList.add('wire-in-slot');
                                        slot.appendChild(wireImg);
                                        slot.classList.add('filled');
                                        wiresOrder[targetPin] = color;
                                        showFeedback(`Fio ${color.replace('-', ' ')} colocado no pino ${targetPin + 1}.`);

                                        touchDragTargetWire.remove(); // Remove o fio original da área
                                        
                                        if (wiresOrder.every(wire => wire !== null)) {
                                            goToStep(6);
                                        }
                                        dropped = true;
                                    } else {
                                        showFeedback('Este pino já está ocupado! Duplo toque para remover.', true);
                                    }
                                } else {
                                    showFeedback('Ainda não é hora de arrastar os fios. Siga as instruções!', true);
                                }
                            }
                            // Limpa highlight dos slots
                            if (!slot.classList.contains('filled')) {
                                slot.style.backgroundColor = '#f9f9f9';
                            }
                        });
                        touchDragTargetWire = null; // Limpa a referência do fio arrastado

                        if (!dropped && currentStep === 5) {
                            showFeedback('Fio solto em área inválida. Arraste para um pino do RJ45.', true);
                        }
                    }
                }
            });
            // --- FIM dos Eventos de TOQUE ---


            // --- Eventos de MOUSE para Drag & Drop (permanecem, mas 'draggable' será controlado pelo JS) ---
            wireContainer.addEventListener('dragstart', (e) => {
                if (currentStep === 5 && wireContainer.classList.contains('draggable')) {
                    dragSound.currentTime = 0;
                    dragSound.play();
                    e.dataTransfer.setData('text/plain', color);
                    dragOriginWire = e.target.closest('.wire');
                    if (dragOriginWire) {
                        dragOriginWire.style.opacity = '0.5';
                    }
                } else {
                    e.preventDefault();
                    showFeedback('Ainda não é hora de arrastar os fios. Siga as instruções!', true);
                }
            });

            wireContainer.addEventListener('dragend', (e) => {
                if (dragOriginWire && dragOriginWire.parentNode) {
                    dragOriginWire.style.opacity = '1';
                }
                dragOriginWire = null;
            });
            // --- FIM dos Eventos de MOUSE ---

            strippedWiresContainer.appendChild(wireContainer);
        });
    }

    // 3. Desentrançar Fios
    toolUntwist.addEventListener('click', () => {
        if (currentStep === 3) {
            if (selectTool(toolUntwist, 'untwist')) {
                strippedWiresContainer.style.backgroundImage = 'none'; // Remove a imagem do cabo trançado
                createIndividualWires(); // Cria os fios individuais e os torna visíveis
                strippedWiresContainer.classList.add('untwisted'); // Adiciona classe para estilo de fios individuais
                untwistSound.play();
                showFeedback('Fios desentrançados!');
                goToStep(4);
            }
        } else if (currentStep > 3 && currentTool === 'untwist') {
            showFeedback('Os fios já foram desentrançados.', false);
        } else if (currentStep < 3 && currentStep !== 0) {
            showFeedback('Por favor, siga a sequência correta. Primeiro, decape o cabo.', true);
        } else if (currentStep === 0) {
            showFeedback('Selecione um padrão de crimpagem primeiro.', true);
        } else {
            showFeedback('Selecione o **Desentrançador** para desentrançar os fios.', true);
        }
    });

    // 4. Cortar Fios
    toolCut.addEventListener('click', () => {
        if (currentStep === 4) {
            if (selectTool(toolCut, 'cut')) {
                strippedWiresContainer.classList.add('aligned'); // Adiciona classe para estilo de fios alinhados
                cutSound.play();
                showFeedback('Fios cortados e alinhados!');
                goToStep(5);
            }
        } else if (currentStep > 4 && currentTool === 'cut') {
            showFeedback('Os fios já foram cortados.', false);
        } else if (currentStep < 4 && currentStep !== 0) {
            showFeedback('Por favor, siga a sequência correta. Primeiro, desentrançe os fios.', true);
        } else if (currentStep === 0) {
            showFeedback('Selecione um padrão de crimpagem primeiro.', true);
        } else {
            showFeedback('Selecione o **Cortador de Fios** para alinhar as pontas.', true);
        }
    });

    // 5. Arrastar e Soltar Fios no RJ45 (Eventos de Mouse)
    pinSlots.forEach(slot => {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (currentStep === 5) {
                slot.style.backgroundColor = '#e0f0ff';
            }
        });

        slot.addEventListener('dragleave', () => {
            if (!slot.classList.contains('filled')) {
                slot.style.backgroundColor = '#f9f9f9';
            }
        });

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            const color = e.dataTransfer.getData('text/plain');
            const targetPin = parseInt(slot.dataset.pin) - 1;

            if (currentStep === 5) {
                if (wiresOrder[targetPin] === null) {
                    const wireImg = document.createElement('img');
                    wireImg.src = wireImages[color];
                    wireImg.classList.add('wire-in-slot');
                    slot.appendChild(wireImg);
                    slot.classList.add('filled');
                    wiresOrder[targetPin] = color;
                    showFeedback(`Fio ${color.replace('-', ' ')} colocado no pino ${targetPin + 1}.`);

                    const droppedWireElement = strippedWiresContainer.querySelector(`.wire[data-color="${color}"]`);
                    if (droppedWireElement) {
                        droppedWireElement.remove();
                    }

                    if (wiresOrder.every(wire => wire !== null)) {
                        goToStep(6);
                    }

                } else {
                    showFeedback('Este pino já está ocupado! Duplo clique para remover.', true);
                }
            } else {
                showFeedback('Ainda não é hora de arrastar os fios. Siga as instruções!', true);
            }
            slot.style.backgroundColor = '#f9f9f9';
        });
    });

    // Função para remover um fio do RJ45 (desfazer)
    pinSlots.forEach(slot => {
        // Evento para Duplo Clique (Mouse)
        slot.addEventListener('dblclick', (e) => {
            handleRemoveWireFromRJ45(slot);
        });

        // Evento para Duplo Toque (Mobile)
        let lastTap = 0;
        slot.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) { // Duplo toque em 300ms
                e.preventDefault(); // Previne zoom
                handleRemoveWireFromRJ45(slot);
            }
            lastTap = currentTime;
        });
    });

    function handleRemoveWireFromRJ45(slot) {
        const targetPin = parseInt(slot.dataset.pin) - 1;
        if (wiresOrder[targetPin] !== null && !cableCrimped && currentStep >= 5 && currentStep < 7) {
            const removedColor = wiresOrder[targetPin];
            wiresOrder[targetPin] = null;
            slot.innerHTML = '';
            slot.classList.remove('filled');
            showFeedback(`Fio ${removedColor.replace('-', ' ')} removido do pino ${targetPin + 1}.`);

            const wireContainer = document.createElement('div');
            wireContainer.classList.add('wire', 'draggable');
            wireContainer.dataset.color = removedColor;

            const wireImg = document.createElement('img');
            wireImg.src = wireImages[removedColor];
            wireImg.alt = removedColor;
            wireContainer.appendChild(wireImg);

            const wireName = document.createElement('span');
            wireName.classList.add('wire-name');
            wireName.textContent = removedColor.replace('-', ' ');
            wireContainer.appendChild(wireName);

            // Re-adiciona os event listeners de drag para mouse
            wireContainer.addEventListener('dragstart', (e) => {
                dragSound.currentTime = 0;
                dragSound.play();
                e.dataTransfer.setData('text/plain', removedColor);
                dragOriginWire = e.target.closest('.wire');
                if (dragOriginWire) {
                    dragOriginWire.style.opacity = '0.5';
                }
            });
            wireContainer.addEventListener('dragend', (e) => {
                if (dragOriginWire && dragOriginWire.parentNode) {
                    dragOriginWire.style.opacity = '1';
                }
                dragOriginWire = null;
            });
            // Re-adiciona os event listeners de toque (drag para mobile)
            let initialX, initialY;
            let currentWireGhost = null;

            wireContainer.addEventListener('touchstart', (e) => {
                if (currentStep === 5 && wireContainer.classList.contains('draggable')) {
                    e.preventDefault();
                    initialX = e.touches[0].clientX;
                    initialY = e.touches[0].clientY;
                    touchDragTargetWire = wireContainer;

                    touchDragGhost = wireContainer.cloneNode(true);
                    touchDragGhost.classList.add('touch-drag-ghost');
                    touchDragGhost.style.position = 'fixed';
                    touchDragGhost.style.left = initialX + 'px';
                    touchDragGhost.style.top = initialY + 'px';
                    touchDragGhost.style.transform = 'translate(-50%, -50%)';
                    document.body.appendChild(touchDragGhost);

                    wireContainer.style.opacity = '0.1';
                    dragSound.currentTime = 0;
                    dragSound.play();
                } else {
                    showFeedback('Ainda não é hora de arrastar os fios. Siga as instruções!', true);
                }
            }, { passive: false });

            wireContainer.addEventListener('touchmove', (e) => {
                if (touchDragGhost) {
                    e.preventDefault();
                    touchDragGhost.style.left = e.touches[0].clientX + 'px';
                    touchDragGhost.style.top = e.touches[0].clientY + 'px';

                    pinSlots.forEach(slot => {
                        const slotRect = slot.getBoundingClientRect();
                        const ghostRect = touchDragGhost.getBoundingClientRect();
                        if (
                            ghostRect.left < slotRect.right &&
                            ghostRect.right > slotRect.left &&
                            ghostRect.top < slotRect.bottom &&
                            ghostRect.bottom > slotRect.top
                        ) {
                            slot.style.backgroundColor = '#e0f0ff';
                        } else {
                             if (!slot.classList.contains('filled')) {
                                slot.style.backgroundColor = '#f9f9f9';
                            }
                        }
                    });
                }
            }, { passive: false });

            wireContainer.addEventListener('touchend', (e) => {
                if (touchDragGhost) {
                    document.body.removeChild(touchDragGhost);
                    touchDragGhost = null;

                    if (touchDragTargetWire) {
                        touchDragTargetWire.style.opacity = '1';

                        let dropped = false;
                        pinSlots.forEach(slot => {
                            const slotRect = slot.getBoundingClientRect();
                            const touchX = e.changedTouches[0].clientX;
                            const touchY = e.changedTouches[0].clientY;

                            if (
                                touchX > slotRect.left &&
                                touchX < slotRect.right &&
                                touchY > slotRect.top &&
                                touchY < slotRect.bottom
                            ) {
                                const targetPin = parseInt(slot.dataset.pin) - 1;
                                const color = touchDragTargetWire.dataset.color;

                                if (currentStep === 5) {
                                    if (wiresOrder[targetPin] === null) {
                                        const wireImg = document.createElement('img');
                                        wireImg.src = wireImages[color];
                                        wireImg.classList.add('wire-in-slot');
                                        slot.appendChild(wireImg);
                                        slot.classList.add('filled');
                                        wiresOrder[targetPin] = color;
                                        showFeedback(`Fio ${color.replace('-', ' ')} colocado no pino ${targetPin + 1}.`);

                                        touchDragTargetWire.remove();
                                        
                                        if (wiresOrder.every(wire => wire !== null)) {
                                            goToStep(6);
                                        }
                                        dropped = true;
                                    } else {
                                        showFeedback('Este pino já está ocupado! Duplo toque para remover.', true);
                                    }
                                } else {
                                    showFeedback('Ainda não é hora de arrastar os fios. Siga as instruções!', true);
                                }
                            }
                            if (!slot.classList.contains('filled')) {
                                slot.style.backgroundColor = '#f9f9f9';
                            }
                        });
                        touchDragTargetWire = null;

                        if (!dropped && currentStep === 5) {
                            showFeedback('Fio solto em área inválida. Arraste para um pino do RJ45.', true);
                        }
                    }
                }
            });

            strippedWiresContainer.appendChild(wireContainer);
            strippedWiresContainer.classList.add('visible');

            if (currentStep === 6) {
                goToStep(5);
            }
        } else if (cableCrimped) {
            showFeedback('O cabo já foi crimpado. Reinicie para fazer novas alterações.', true);
        } else if (currentStep < 5 || currentStep >= 7) {
             showFeedback('Não é possível remover fios nesta etapa.', true);
        }
    }


    // 6. Crimpar o Cabo
    toolCrimper.addEventListener('click', () => {
        if (currentStep === 6) {
            if (selectTool(toolCrimper, 'crimper')) {
                crimpSound.play();
                setTimeout(() => {
                    let correctOrder;
                    if (currentPattern === 'Crossover') {
                        correctOrder = patterns['Crossover']['end1'];
                    } else {
                        correctOrder = patterns[currentPattern];
                    }
                    
                    let isCorrect = true;
                    const errors = [];

                    for (let i = 0; i < 8; i++) {
                        if (wiresOrder[i] !== correctOrder[i]) {
                            isCorrect = false;
                            errors.push(`Pino ${i + 1}: Esperado "${correctOrder[i].replace('-', ' ')}", Encontrado "${wiresOrder[i] ? wiresOrder[i].replace('-', ' ') : 'Vazio'}"`);
                        }
                    }

                    if (isCorrect) {
                        showFeedback('Crimpagem realizada com sucesso! A ordem dos fios está correta.', false);
                    } else {
                        showFeedback('Erro na crimpagem! A ordem dos fios está incorreta.', true);
                        testerMessage.textContent = 'Erros de Crimpagem: ' + errors.join('; ');
                    }
                    cableCrimped = true;
                    goToStep(7);
                }, 500);
            }
        } else if (currentStep > 6 && currentTool === 'crimper') {
            showFeedback('O cabo já foi crimpado. Teste-o ou reinicie a simulação.', false);
        } else if (currentStep < 6 && currentStep !== 0) {
            showFeedback('Por favor, siga a sequência correta. Arraste os fios para o RJ45 primeiro.', true);
        } else if (currentStep === 0) {
            showFeedback('Selecione um padrão de crimpagem primeiro.', true);
        } else {
            showFeedback('Selecione o **Alicate de Crimpar** para finalizar a crimpagem.', true);
        }
    });

    // 7. Testar o Cabo com Animação
    testButton.addEventListener('click', () => {
        if (currentStep === 7 && cableCrimped) {
            testButton.disabled = true;
            testerMessage.textContent = 'Testando cabo...';

            testerLights.forEach(light => {
                light.classList.remove('on', 'error');
            });

            const correctOrderForTesting = (currentPattern === 'Crossover') ? patterns['Crossover']['end1'] : patterns[currentPattern];
            
            let allCorrect = true;
            let testIndex = 0;
            const testDelay = 200;

            const intervalId = setInterval(() => {
                if (testIndex < testerLights.length) {
                    const light = testerLights[testIndex];
                    
                    if (wiresOrder[testIndex] === correctOrderForTesting[testIndex]) {
                        light.classList.add('on');
                    } else {
                        light.classList.add('error');
                        allCorrect = false;
                    }
                    testIndex++;
                } else {
                    clearInterval(intervalId);
                    
                    if (allCorrect) {
                        testerMessage.textContent = 'Cabo testado: Perfeito! Todas as conexões estão corretas.';
                        showFeedback('Cabo PERFEITO! Parabéns!', false);
                    } else {
                        testerMessage.textContent = 'Cabo testado: Erro detectado. Verifique os pinos com luz vermelha.';
                        showFeedback('Cabo com ERRO! Revise a ordem dos fios.', true);
                    }
                    updateInstructions('Cabo testado. Para uma nova tentativa, clique em **Reiniciar Simulação**.');
                    highlightTarget('cable-tester', false);
                }
            }, testDelay);
        } else if (currentStep !== 7) {
            showFeedback('Ainda não é hora de testar o cabo. Crimpagem é necessária!', true);
        } else if (!cableCrimped) {
            showFeedback('O cabo ainda não foi crimpado ou a crimpagem foi incorreta.', true);
        }
    });

    // Reiniciar Simulação
    resetButton.addEventListener('click', () => {
        currentPattern = null;
        currentTool = null;
        currentStep = 0;
        wiresOrder = new Array(8).fill(null);
        cableCrimped = false;
        dragOriginWire = null;
        touchDragGhost = null;
        touchDragTargetWire = null;

        cableImg.src = 'js/assets/cable_utp.png';
        cableImg.classList.remove('hidden');
        strippedWiresContainer.innerHTML = '';
        strippedWiresContainer.classList.remove('visible', 'untwisted', 'aligned');
        strippedWiresContainer.style.backgroundImage = 'none';
        strippedWiresContainer.style.display = 'none';

        pinSlots.forEach(slot => {
            slot.innerHTML = '';
            slot.classList.remove('filled', 'highlight-drop');
            slot.style.backgroundColor = '';
        });
        testerLights.forEach(light => {
            light.classList.remove('on', 'error');
        });
        testerMessage.textContent = '';
        testButton.disabled = true;

        selectT568AButton.disabled = false;
        selectT568BButton.disabled = false;
        selectCrossoverButton.disabled = false;

        document.querySelectorAll('.tool.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.step-target.highlight, .tool.highlight').forEach(el => el.classList.remove('highlight'));

        // Certifique-se de que o modal está escondido no reset, a menos que queira que apareça
        // welcomeModal.style.display = 'none'; 
        goToStep(0);
    });

    // INÍCIO DO SIMULADOR
    // Ao carregar a página, exibe o modal de boas-vindas.
    // O simulador só realmente começa quando o botão "Começar Simulação" é clicado.
    welcomeModal.style.display = 'flex'; // Garante que o modal está visível ao carregar
    // Não chame goToStep(0) aqui, pois ele será chamado pelo clique do botão do modal.
});
