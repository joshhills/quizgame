let numQuestions = 0;

const accordion = document.getElementById('accordion');

function updateQuestionNumbers() {
    const items = Array.from(accordion.children);
    for (let i = 0; i < items.length; i++) {
        const uid = items[i].dataset.uid;
        document.getElementById(`questionnum-${uid}`).innerHTML = i + 1;
    }
}

const sortable = new Sortable(accordion, {
    handle: '.bi-grip-vertical',
    onSort: updateQuestionNumbers
});

function removeQuestion(uid) {
    accordion.removeChild(document.getElementById(`question-${uid}`));
    numQuestions--;
    updateQuestionNumbers();
}

async function imageExists(imageUrl) {

    if (!imageUrl) {
        return false;
    }

    try {
        return await fetch(`/imageExists?url=${encodeURIComponent(imageUrl)}`, { method: 'GET' })
        .then(res => {
            return res.status === 200;
        }).catch(() => false);
    } catch (e) {
        return false;
    }
}

function deQuote(str) {
    return str.replace(/"/gi, '&quot;');
}

document.getElementById('loadquiz').addEventListener('click', () => {
    let input = document.createElement('input');
    input.type = 'file';
    input.onchange = _ => {
            let file = Array.from(input.files)[0];

            readFileContents(file).then(content => {
                
                document.getElementById('quizname').value = content.name;
                document.getElementById('quizstartingmoney').value = content.startingMoney;
                document.getElementById('quizallowhints').value = content.allowHints;
                document.getElementById('quiznumhints').value = content.numHints;
                document.getElementById('quizincrementeachround').value = content.incrementEachRound;
                document.getElementById('quizsecondsperquestion').value = content.secondsPerQuestion;

                document.getElementById('accordion').innerHTML = '';
                numQuestions = content.questions.length;

                for (let i = 0; i < content.questions.length; i++) {
                    const j = generateUID();

                    console.log(content.questions[i].options);

                    document.getElementById('accordion').insertAdjacentHTML('beforeend',
                        `<div class="accordion-item" id="question-${j}" data-uid="${j}">
                            <div class="accordion-header">
                                <h5 class="mb-0">
                                    <button class="accordion-button collapsed" data-bs-toggle="collapse" data-bs-target="#collapse-${j}">
                                        <span class="bi bi-grip-vertical me-2"></span>
                                        <span style="width: 100%;">
                                            Question <span id="questionnum-${j}">${i + 1}</span>&nbsp;<span id="questionsnippet-${i}">- ${truncate(content.questions[i].text)}</span>
                                        </span>
                                        <a id="remove-${j}" class="btn btn-danger me-3">
                                            <span class="bi bi-x-circle"/>
                                        </a>
                                    </button>
                                </h5>
                            </div>

                            <div id="collapse-${j}" class="accordion-collapse collapse">
                                <div class="accordion-body">
                                    <!-- Text -->
                                    <div class="mb-3">
                                        <label class="form-label">Question Text</label>
                                        <textarea class="form-control" rows="3" placeholder="Write a question here" id="questiontext-${j}">${content.questions[i].text ? content.questions[i].text : ''}</textarea>
                                    </div>
                                    <!-- Host Additional Text -->
                                    <div class="mb-3">
                                        <label class="form-label">Additional Info</label>
                                        <textarea class="form-control" rows="3" placeholder="Write some optional, additional info here for the host" id="questionadditionaltext-${j}">${content.questions[i].additionalText ? content.questions[i].additionalText : ''}</textarea>
                                    </div>
                                    <!-- Options -->
                                    <div class="mb-3">
                                        <label class="form-label">Option A</label>
                                        <input type="text" class="form-control" placeholder="A Text" id="questionoptiona-${j}" value="${content.questions[i].options.a ? deQuote(content.questions[i].options.a) : ''}" />
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Option B</label>
                                        <input type="text" class="form-control" placeholder="B Text" id="questionoptionb-${j}" value="${content.questions[i].options.b ? deQuote(content.questions[i].options.b) : ''}" />
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Option C</label>
                                        <input type="text" class="form-control" placeholder="C Text" id="questionoptionc-${j}" value="${content.questions[i].options.c ? deQuote(content.questions[i].options.c) : ''}" />
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Option D</label>
                                        <input type="text" class="form-control" placeholder="D Text" id="questionoptiond-${j}" value="${content.questions[i].options.d ? deQuote(content.questions[i].options.d) : ''}" />
                                    </div>
                                    <!-- Answer -->
                                    <div class="mb-3">
                                        <label class="form-label">Answer</label>
                                        <select class="form-select" id="questionanswer-${j}">
                                            <option selected value="none">Choose an answer</option>
                                            <option value="a" ${content.questions[i].answer === 'a' ? 'selected' : ''}>A</option>
                                            <option value="b" ${content.questions[i].answer === 'b' ? 'selected' : ''}>B</option>
                                            <option value="c" ${content.questions[i].answer === 'c' ? 'selected' : ''}>C</option>
                                            <option value="d" ${content.questions[i].answer === 'd' ? 'selected' : ''}>D</option>
                                        </select>
                                    </div>
                                    <!-- Pre Image -->
                                    <div class="mb-3">
                                        <label class="form-label">Pre Image (optional)</label>
                                        <input type="text" class="form-control" placeholder="https://example.com/image.jpg" id="questionpreimage-${j}"  value="${content.questions[i].preImageUrl ? content.questions[i].preImageUrl : ''}" />
                                        <image id="questionpreimageloaded-${j}" class="img-thumbnail mt-3" src="" />
                                    </div>
                                    <!-- Post Image -->
                                    <div class="mb-3">
                                        <label class="form-label">Post Image (optional)</label>
                                        <input type="text" class="form-control" placeholder="https://example.com/image.jpg" id="questionpostimage-${j}" value="${content.questions[i].postImageUrl ? content.questions[i].postImageUrl : ''}" />
                                        <image id="questionpostimageloaded-${j}" class="img-thumbnail mt-3" src="" />
                                    </div>
                                </div>
                            </div>
                        </div>`
                    );

                    // Register listeners against the context of the new accordion item
                    document.getElementById(`questiontext-${j}`).addEventListener('input', (e) => {
                        const newVal = e.target.value;
                        const snippet = document.getElementById(`questionsnippet-${j}`);
                        if (newVal && newVal.trim().length > 0) {
                            snippet.innerHTML = `- ${truncate(newVal)}`;
                        } else {
                            snippet.innerHTML = '';
                        }
                    });
                    document.getElementById(`remove-${j}`).addEventListener('click', () => {
                        removeQuestion(j);
                    });
                    document.getElementById(`questionpreimage-${j}`).addEventListener('input', (e) => {
                        const newVal = e.target.value;

                        imageExists(newVal).then(answer => {
                            document.getElementById(`questionpreimageloaded-${j}`).hidden = !answer;
                            document.getElementById(`questionpreimage-${j}`).className = 'form-control';
                            if (answer) {
                                document.getElementById(`questionpreimageloaded-${j}`).src = newVal;
                            } else if (newVal) {
                                document.getElementById(`questionpreimage-${j}`).className = 'form-control is-invalid';
                            }
                        });
                    });
                    document.getElementById(`questionpostimage-${j}`).addEventListener('input', (e) => {
                        const newVal = e.target.value;

                        imageExists(newVal).then(answer => {
                            document.getElementById(`questionpostimageloaded-${j}`).hidden = !answer;
                            document.getElementById(`questionpostimage-${j}`).className = 'form-control';
                            if (answer) {
                                document.getElementById(`questionpostimageloaded-${j}`).src = newVal;
                            } else if (newVal) {
                                document.getElementById(`questionpostimage-${j}`).className = 'form-control is-invalid';
                            }
                        });
                    });

                    // Load initial images
                    imageExists(content.questions[i].preImageUrl).then(answer => {
                        document.getElementById(`questionpreimageloaded-${j}`).hidden = !answer;
                        document.getElementById(`questionpreimage-${j}`).className = 'form-control';
                        if (answer) {
                            document.getElementById(`questionpreimageloaded-${j}`).src = content.questions[i].preImageUrl;
                        } else if (content.questions[i].preImageUrl) {
                            document.getElementById(`questionpreimage-${j}`).className = 'form-control is-invalid';
                        }
                    });

                    // Load initial images
                    imageExists(content.questions[i].postImageUrl).then(answer => {
                        document.getElementById(`questionpostimageloaded-${j}`).hidden = !answer;
                        document.getElementById(`questionpostimage-${j}`).className = 'form-control';
                        if (answer) {
                            document.getElementById(`questionpostimageloaded-${j}`).src = content.questions[i].postImageUrl;
                        } else if (content.questions[i].postImageUrl) {
                            document.getElementById(`questionpostimage-${j}`).className = 'form-control is-invalid';
                        }
                    });
                }

            }).catch(error => console.log(error));
        };
    input.click();
});

function readFileContents(file) {
	const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = event => resolve(JSON.parse(event.target.result));
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

function generateUID() {
    var firstPart = (Math.random() * 46656) | 0;
    var secondPart = (Math.random() * 46656) | 0;
    firstPart = ("000" + firstPart.toString(36)).slice(-3);
    secondPart = ("000" + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
}

document.getElementById('addquestion').addEventListener('click', () => {
    console.log('Adding question');

    let i = generateUID();

    document.getElementById('accordion').insertAdjacentHTML('beforeend',
        `<div class="accordion-item" id="question-${i}" data-uid="${i}">
            <div class="accordion-header">
                <h5 class="mb-0">
                    <button class="accordion-button collapsed" data-bs-toggle="collapse" data-bs-target="#collapse-${i}">
                        <span class="bi bi-grip-vertical me-2"></span>
                        <span style="width: 100%;">
                            Question <span id="questionnum-${i}">${numQuestions + 1}</span>&nbsp;<span id="questionsnippet-${i}"></span>
                        </span>
                        <a id="remove-${i}" class="btn btn-danger me-3">
                            <span class="bi bi-x-circle"/>
                        </a>
                    </button>
                </h5>
            </div>

            <div id="collapse-${i}" class="accordion-collapse collapse">
                <div class="accordion-body">
                    <!-- Text -->
                    <div class="mb-3">
                        <label class="form-label">Question Text</label>
                        <textarea class="form-control" rows="3" placeholder="Write a question here" id="questiontext-${i}"></textarea>
                    </div>
                    <!-- Host Additional Text -->
                    <div class="mb-3">
                        <label class="form-label">Additional Info</label>
                        <textarea class="form-control" rows="3" placeholder="Write some optional, additional info here for the host" id="questionadditionaltext-${i}"></textarea>
                    </div>
                    <!-- Options -->
                    <div class="mb-3">
                        <label class="form-label">Option A</label>
                        <input type="text" class="form-control" placeholder="A Text" id="questionoptiona-${i}" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Option B</label>
                        <input type="text" class="form-control" placeholder="B Text" id="questionoptionb-${i}" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Option C</label>
                        <input type="text" class="form-control" placeholder="C Text" id="questionoptionc-${i}" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Option D</label>
                        <input type="text" class="form-control" placeholder="D Text" id="questionoptiond-${i}" />
                    </div>
                    <!-- Answer -->
                    <div class="mb-3">
                        <label class="form-label">Answer</label>
                        <select class="form-select" id="questionanswer-${i}">
                            <option selected value="none">Choose an answer</option>
                            <option value="a">A</option>
                            <option value="b">B</option>
                            <option value="c">C</option>
                            <option value="d">D</option>
                        </select>
                    </div>
                    <!-- Pre Image -->
                    <div class="mb-3">
                        <label class="form-label">Pre Image (optional)</label>
                        <input type="text" class="form-control" placeholder="https://example.com/image.jpg" id="questionpreimage-${i}" />
                        <image id="questionpreimageloaded-${i}" class="img-thumbnail mt-3" src="" hidden="true" />
                    </div>
                    <!-- Post Image -->
                    <div class="mb-3">
                        <label class="form-label">Post Image (optional)</label>
                        <input type="text" class="form-control" placeholder="https://example.com/image.jpg" id="questionpostimage-${i}" />
                        <image id="questionpostimageloaded-${i}" class="img-thumbnail mt-3" src="" hidden="true" />
                    </div>
                </div>
            </div>
        </div>`
    );

    numQuestions++;

    // Register listeners against the context of the new accordion item
    document.getElementById(`questiontext-${i}`).addEventListener('input', (e) => {
        const newVal = e.target.value;
        const snippet = document.getElementById(`questionsnippet-${i}`);
        if (newVal && newVal.trim().length > 0) {
            snippet.innerHTML = `- ${truncate(newVal)}`;
        } else {
            snippet.innerHTML = '';
        }
    });
    document.getElementById(`remove-${i}`).addEventListener('click', () => {
        removeQuestion(i);
    });
    
    document.getElementById(`questionpreimage-${i}`).addEventListener('input', (e) => {
        const newVal = e.target.value;

        imageExists(newVal).then(answer => {
            document.getElementById(`questionpreimageloaded-${i}`).hidden = !answer;
            document.getElementById(`questionpreimage-${i}`).className = 'form-control';
            if (answer) {
                document.getElementById(`questionpreimageloaded-${i}`).src = newVal;
            } else if (newVal) {
                document.getElementById(`questionpreimage-${i}`).className = 'form-control is-invalid';
            }
        });
    });
    document.getElementById(`questionpostimage-${i}`).addEventListener('input', (e) => {
        const newVal = e.target.value;

        imageExists(newVal).then(answer => {
            document.getElementById(`questionpostimageloaded-${i}`).hidden = !answer;
            document.getElementById(`questionpostimage-${i}`).className = 'form-control';
            if (answer) {
                document.getElementById(`questionpostimageloaded-${i}`).src = newVal;
            } else if (newVal) {
                document.getElementById(`questionpostimage-${i}`).className = 'form-control is-invalid';
            }
        });
    });

    document.getElementById(`questiontext-${i}`).addEventListener('input', (e) => {
        if (isBlank(e.target.value)) {
            e.target.classList = 'form-control is-invalid';
        } else {
            e.target.classList = 'form-control';
        }
    });
    document.getElementById(`questionoptiona-${i}`).addEventListener('input', (e) => {
        if (isBlank(e.target.value)) {
            e.target.classList = 'form-control is-invalid';
        } else {
            e.target.classList = 'form-control';
        }
    });
    document.getElementById(`questionoptionb-${i}`).addEventListener('input', (e) => {
        if (isBlank(e.target.value)) {
            e.target.classList = 'form-control is-invalid';
        } else {
            e.target.classList = 'form-control';
        }
    });
    document.getElementById(`questionoptionc-${i}`).addEventListener('input', (e) => {
        if (isBlank(e.target.value)) {
            e.target.classList = 'form-control is-invalid';
        } else {
            e.target.classList = 'form-control';
        }
    });
    document.getElementById(`questionoptiond-${i}`).addEventListener('input', (e) => {
        if (isBlank(e.target.value)) {
            e.target.classList = 'form-control is-invalid';
        } else {
            e.target.classList = 'form-control';
        }
    });
    document.getElementById(`questionanswer-${i}`).addEventListener('input', (e) => {
        if (e.target.value === 'none') {
            e.target.classList = 'form-select is-invalid';
        } else {
            e.target.classList = 'form-select';
        }
    });
});

document.getElementById('savequiz').addEventListener('click', () => {
    console.log('Saving quiz');
    
    validateQuiz().then(allGood => {
        if (!allGood) {
            // Spawn error message
            document.getElementById('erroralert').hidden = false;
            console.error('There was an error validating the quiz');
            return;
        } else {
            document.getElementById('erroralert').hidden = true;
        }

        const quizName = document.getElementById('quizname').value;
        const exportObj = {
            "name": quizName,
            "startingMoney": +document.getElementById('quizstartingmoney').value,
            "allowHints": document.getElementById('quizallowhints').value === "on" ? true : false,
            "numHints": +document.getElementById('quiznumhints').value,
            "incrementEachRound": +document.getElementById('quizincrementeachround').value,
            "secondsPerQuestion": +document.getElementById('quizsecondsperquestion').value,
            questions: parseQuestions()
        };
    
        downloadObjectAsJson(exportObj, quizName);
    });
});

async function validateQuiz() {

    let allGood = true;

    const elQuizName = document.getElementById('quizname');
    if (isBlank(elQuizName.value)) {
        elQuizName.classList = 'form-control is-invalid';
        allGood = false;
    } else {
        elQuizName.classList = 'form-control';
    }

    const elStartingMoney = document.getElementById('quizstartingmoney');
    if (!elStartingMoney.value || elStartingMoney.value === 0 || elStartingMoney.value < 0) {
        elStartingMoney.classList = 'form-control is-invalid';
        allGood = false;
    } else {
        elStartingMoney.classList = 'form-control';
    }

    const elNumHints = document.getElementById('quiznumhints');
    if (elNumHints.value < 0) {
        elNumHints.classList = 'form-control is-invalid';
        allGood = false;
    } else {
        elNumHints.classList = 'form-control';
    }

    const elIncrementEachRound = document.getElementById('quizincrementeachround');
    if (elIncrementEachRound.value < 0) {
        elIncrementEachRound.classList = 'form-control is-invalid';
        allGood = false;
    } else {
        elIncrementEachRound.classList = 'form-control';
    }

    const elSecondsPerQuestion = document.getElementById('quizsecondsperquestion');
    if (elSecondsPerQuestion.value < 0) {
        elSecondsPerQuestion.classList = 'form-control is-invalid';
        allGood = false;
    } else {
        elSecondsPerQuestion.classList = 'form-control';
    }

    for (let j = 0; j < numQuestions; j++) {

        const i = Array.from(accordion.children)[j].dataset.uid;

        const elQuestionText = document.getElementById(`questiontext-${i}`);
        const elOptionA = document.getElementById(`questionoptiona-${i}`);
        const elOptionB = document.getElementById(`questionoptionb-${i}`);
        const elOptionC = document.getElementById(`questionoptionc-${i}`);
        const elOptionD = document.getElementById(`questionoptiond-${i}`);
        const elAnswer = document.getElementById(`questionanswer-${i}`);
        const elPreImageUrl = document.getElementById(`questionpreimage-${i}`);
        const elPostImageUrl = document.getElementById(`questionpostimage-${i}`);

        if (isBlank(elQuestionText.value)) {
            elQuestionText.classList = 'form-control is-invalid';
            allGood = false;
        } else {
            elQuestionText.classList = 'form-control';
        }

        if (isBlank(elOptionA.value)) {
            elOptionA.classList = 'form-control is-invalid';
            allGood = false;
        } else {
            elOptionA.classList = 'form-control';
        }

        if (isBlank(elOptionB.value)) {
            elOptionB.classList = 'form-control is-invalid';
            allGood = false;
        } else {
            elOptionB.classList = 'form-control';
        }

        if (isBlank(elOptionC.value)) {
            elOptionC.classList = 'form-control is-invalid';
            allGood = false;
        } else {
            elOptionC.classList = 'form-control';
        }

        if (isBlank(elOptionD.value)) {
            elOptionD.classList = 'form-control is-invalid';
            allGood = false;
        } else {
            elOptionD.classList = 'form-control';
        }

        if (elAnswer.value !== 'a'
            && elAnswer.value !== 'b'
            && elAnswer.value !== 'c'
            && elAnswer.value !== 'd') {
            elAnswer.classList = 'form-select is-invalid';
            allGood = false;
        } else {
            elAnswer.classList = 'form-select';
        }

        if (!isBlank(elPreImageUrl.value)) {
            const imageDoesExists = await imageExists(elPreImageUrl.value);
            if (!imageDoesExists) {
                allGood = false;
            }
        }

        if (!isBlank(elPostImageUrl.value)) {
            const imageDoesExists = await imageExists(elPostImageUrl.value);
            if (!imageDoesExists) {
                allGood = false;
            }
        }
    }

    return allGood;
}

function truncate(str) {
    return (str.length > 32) ? str.substr(0, 32-1) + '&hellip;' : str;
}

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}

function cleanString(str) {
    return str;
}

function parseQuestions() {
    let questions = [];

    for (let j = 0; j < numQuestions; j++) {
        
        const i = Array.from(accordion.children)[j].dataset.uid;
        
        questions.push({
            "text": cleanString(document.getElementById(`questiontext-${i}`).value),
            "additionalText": cleanString(document.getElementById(`questionadditionaltext-${i}`).value),
            "options": {
                "a": cleanString(document.getElementById(`questionoptiona-${i}`).value),
                "b": cleanString(document.getElementById(`questionoptionb-${i}`).value),
                "c": cleanString(document.getElementById(`questionoptionc-${i}`).value),
                "d": cleanString(document.getElementById(`questionoptiond-${i}`).value)
            },
            "answer": document.getElementById(`questionanswer-${i}`).value,
            "preImageUrl": document.getElementById(`questionpreimage-${i}`).value,
            "postImageUrl": document.getElementById(`questionpostimage-${i}`).value
        });
    }

    return questions;
}

function downloadObjectAsJson(exportObj, exportName){
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}