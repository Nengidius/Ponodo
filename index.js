document.addEventListener('DOMContentLoaded', function () {
    const dateElement = document.getElementById('date');
    const dayElement = document.getElementById('day');
    const monthElement = document.getElementById('month');
    const yearElement = document.getElementById('year');
    const prevDateButton = document.getElementById('prev-date');
    const nextDateButton = document.getElementById('next-date');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');
    const toggleButton = document.getElementById('toggle');
    const notesApp = document.getElementById('notes-app');
    const todoList = document.getElementById('todo-list');
    const importButton = document.getElementById('import-todo-notes');
    const fehTimerProgress = document.getElementById('feh-timer-progress');
    const playPauseButton = document.getElementById('play-pause-button');
    const resetButton = document.getElementById('reset-button');
    const nextButton = document.getElementById('next-button');

    let timerInterval;
    let isTimerRunning = false;
    let remainingTime = 0;
    let currentTaskIndex = 0;
    let currentSession = 0;
    let tasks = [];
    let isResting = false;

    const WORK_SESSION_DURATION = 25 * 60; // 25 minutes per session
    const REST_DURATION = 5 * 60; // 5 minutes rest period

    // Initialize the calendar
    let currentDate = new Date();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    function updateCalendar() {
        const day = currentDate.getDate();
        const month = months[currentDate.getMonth()];
        const year = currentDate.getFullYear();
        const dayOfWeek = daysOfWeek[currentDate.getDay()];

        dateElement.textContent = day < 10 ? `0${day}` : day;
        monthElement.textContent = month;
        yearElement.textContent = year;
        dayElement.textContent = dayOfWeek;

        loadSavedData();
    }

    function changeDate(offset) {
        currentDate.setDate(currentDate.getDate() + offset);
        updateCalendar();
    }

    function changeMonth(offset) {
        currentDate.setMonth(currentDate.getMonth() + offset);
        updateCalendar();
    }

    prevDateButton.addEventListener('click', () => changeDate(-1));
    nextDateButton.addEventListener('click', () => changeDate(1));
    prevMonthButton.addEventListener('click', () => changeMonth(-1));
    nextMonthButton.addEventListener('click', () => changeMonth(1));

    // Toggle notes and todo list
    toggleButton.addEventListener('click', () => {
        if (notesApp.style.display === 'none') {
            notesApp.style.display = 'block';
            todoList.style.display = 'none';
        } else {
            notesApp.style.display = 'none';
            todoList.style.display = 'block';
        }
    });

    // Import notes to todo list
    importButton.addEventListener('click', () => {
        saveData();
        changeDate(1);

        const previousDate = new Date(currentDate);
        previousDate.setDate(currentDate.getDate() - 1);

        const prevDateKey = `${previousDate.getFullYear()}-${previousDate.getMonth() + 1}-${previousDate.getDate()}`;
        const nextDateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;

        const savedData = JSON.parse(localStorage.getItem(prevDateKey));

        if (savedData) {
            const todoItems = savedData.todoItems || [];
            const notes = savedData.notes || [];

            const newData = { todoItems, notes };
            localStorage.setItem(nextDateKey, JSON.stringify(newData));

            loadSavedData();
        }
    });

    // Check if the tasks belong to today's date
    function isTodayTask() {
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
        const currentDateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
        return todayKey === currentDateKey;
    }

    // Initialize the tasks array
    function initializeTasks() {
        tasks = Array.from(todoList.querySelectorAll('li')).map((task, index) => {
            const hours = parseInt(task.querySelector('#hoursInput').value) || 0;
            const minutes = parseInt(task.querySelector('#minutesInput').value) || 0;
            const totalTimeInSeconds = hours * 3600 + minutes * 60;
            const sessions = Math.ceil(totalTimeInSeconds / WORK_SESSION_DURATION);

            // Check if the task belongs to the current date
            const taskDateKey = task.dataset.dateKey || `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
            if (taskDateKey !== `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`) {
                return null; // Ignore tasks not associated with the current date
            }

            return {
                element: task,
                sessions,
                timeInSeconds: totalTimeInSeconds > 0 ? WORK_SESSION_DURATION : 0, // Only set WORK_SESSION_DURATION if time is allocated
                completed: false
            };
        }).filter(task => task !== null); // Filter out null tasks

        // Filter out tasks with no allocated time
        tasks = tasks.filter(task => task.timeInSeconds > 0);

        // Disable or enable timer based on the presence of today's tasks
        playPauseButton.disabled = tasks.length === 0;

        currentSession = 0; // Reset session index
        isResting = false; // Reset resting state
    }

    // Update the timer display
    function updateTimerDisplay(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        fehTimerProgress.querySelector('#feh-timer-time').textContent = `${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    
        const duration = isResting ? REST_DURATION : WORK_SESSION_DURATION;
        const progress = (seconds / duration) * 100; // Calculate percentage of time remaining

        // Update the strokeDashoffset to sync with the countdown
        const circle = fehTimerProgress.querySelector('.circle-progress');
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (circumference * progress / 100);

        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${offset}`;

    // Update timer labels
        if (isResting) {
        fehTimerProgress.querySelector('#feh-timer-rest').textContent = 'Rest';
        fehTimerProgress.querySelector('#feh-timer-work').textContent = '';
        fehTimerProgress.querySelector('#feh-timer-pause').textContent = '';
        } else if (isTimerRunning) {
            fehTimerProgress.querySelector('#feh-timer-rest').textContent = '';
            fehTimerProgress.querySelector('#feh-timer-work').textContent = 'Work';
            fehTimerProgress.querySelector('#feh-timer-pause').textContent = '';
        } else {
            fehTimerProgress.querySelector('#feh-timer-rest').textContent = '';
            fehTimerProgress.querySelector('#feh-timer-work').textContent = '';
            fehTimerProgress.querySelector('#feh-timer-pause').textContent = 'Paused';
        }
    }

    // Start the timer for the current task session or rest period
    function startTimer() {
        if (!isTodayTask() || tasks.length === 0) {
            playPauseButton.textContent = 'Start Work'; // Ensure button shows 'Start Work'
            return;
        }

        if (isTimerRunning || tasks.length === 0) return;

        const taskDateKey = tasks[currentTaskIndex].element.dataset.dateKey;
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

        if (taskDateKey !== todayKey) {
            alert('This task is not assigned to today\'s date. Please select a task assigned to today\'s date.');
            return;
        }

        // Disable input fields for the current task
        const taskElement = tasks[currentTaskIndex].element;
        disableTaskInputFields(taskElement);

        remainingTime = isResting ? REST_DURATION : tasks[currentTaskIndex].timeInSeconds;
        isTimerRunning = true;

        timerInterval = setInterval(() => {
            remainingTime--;
            updateTimerDisplay(remainingTime);

            if (remainingTime <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;

                if (!isResting) {
                    currentSession++;
                    if (currentSession < tasks[currentTaskIndex].sessions) {
                        isResting = true;
                        playPauseButton.textContent = 'Start Break'; // Indicate that the next session is a break
                    } else {
                        tasks[currentTaskIndex].element.querySelector('.task-checkbox').checked = true; // Mark task as complete
                        // Fields remain disabled after task completion
                        resetTimer(); // Reset the timer after task completion
                        playPauseButton.textContent = 'Start Next Task'; // Allow user to start the next task
                    }
                } else {
                    isResting = false;
                    resetTimer(); // Reset the timer after break
                    playPauseButton.textContent = 'Start Work'; // Indicate that the next session is work
                }
            }
        }, 1000);
    }

    // Function to disable input fields for the current task
    function disableTaskInputFields(taskElement) {
        taskElement.querySelector('.task-input').disabled = true;
        taskElement.querySelector('#hoursInput').disabled = true;
        taskElement.querySelector('#minutesInput').disabled = true;
    }

    // Function to enable input fields for a task
    function enableTaskInputFields(taskElement) {
        taskElement.querySelector('.task-input').disabled = false;
        taskElement.querySelector('#hoursInput').disabled = false;
        taskElement.querySelector('#minutesInput').disabled = false;
    }

    // Reset the timer
    function resetTimer() {
        clearInterval(timerInterval);
        isTimerRunning = false;

        // Ensure fields remain disabled after reset if the task is completed
        if (!tasks[currentTaskIndex].element.querySelector('.task-checkbox').checked) {
            enableTaskInputFields(tasks[currentTaskIndex].element); // Re-enable input fields if the task is not completed
        }

        currentTaskIndex = 0;
        currentSession = 0;
        isResting = false;
        remainingTime = tasks[currentTaskIndex] ? tasks[currentTaskIndex].timeInSeconds : 0;
        updateTimerDisplay(remainingTime);
        playPauseButton.textContent = 'Start Work'; // Reset button to start work
        playPauseButton.disabled = false; // Re-enable the button
    }

    // Move to the next task
    function moveToNextTask() {
        // Ensure fields remain disabled if the task is completed
        if (!tasks[currentTaskIndex].element.querySelector('.task-checkbox').checked) {
            enableTaskInputFields(tasks[currentTaskIndex].element); // Re-enable input fields for the current task before moving to the next
        }

        currentTaskIndex++;
        currentSession = 0;

        if (currentTaskIndex < tasks.length) {
            if (tasks[currentTaskIndex].timeInSeconds > 0) {
                disableTaskInputFields(tasks[currentTaskIndex].element); // Disable input fields for the next task
                playPauseButton.textContent = 'Start Work'; // Indicate that the next session is work
                startTimer(); // Automatically start the timer for the next task
            } else {
                moveToNextTask(); // Skip tasks with zero time
            }
        } else {
            playPauseButton.textContent = 'All Tasks Complete'; // Indicate that all tasks are complete
            playPauseButton.disabled = true; // Disable the button since all tasks are complete
        }
    }

    // Initialize tasks and start the timer when the play button is clicked
    playPauseButton.addEventListener('click', () => {
        if (isTimerRunning) {
            clearInterval(timerInterval);
            isTimerRunning = false;
            playPauseButton.textContent = 'Resume';
        } else {
            if (tasks.length === 0) initializeTasks();
            if (tasks.length > 0 && tasks[currentTaskIndex].timeInSeconds > 0) {
                startTimer();
                playPauseButton.textContent = isResting ? 'Pause Break' : 'Pause Work';
            } else {
                moveToNextTask(); // Skip to the next task if the current one has zero time
            }
        }
    });

    // Reset the timer when the reset button is clicked
    resetButton.addEventListener('click', () => {
        resetTimer();
    });

    // Skip to the next task when the next button is clicked
    nextButton.addEventListener('click', () => {
        clearInterval(timerInterval);
        isTimerRunning = false;
        isResting = !isResting; // Toggle between work and rest
        remainingTime = isResting ? REST_DURATION : WORK_SESSION_DURATION;
        startTimer();
    });

    // Save to-do list and notes to local storage
    function saveData() {
        const key = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
        const todoItems = Array.from(todoList.querySelectorAll('li')).map(li => {
            return {
                task: li.querySelector('.task-input').value,
                hours: li.querySelector('#hoursInput').value,
                minutes: li.querySelector('#minutesInput').value,
                checked: li.querySelector('.task-checkbox').checked,
                dateKey: key // Store the date key with each task
            };
        });
        const notes = Array.from(notesApp.querySelectorAll('input[type="text"]')).map(input => input.value);

        const data = { todoItems, notes };
        localStorage.setItem(key, JSON.stringify(data));
    }

    // Load saved data for the current date
    function loadSavedData() {
        const key = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
        const savedData = JSON.parse(localStorage.getItem(key));

        if (savedData) {
            const todoItems = savedData.todoItems || [];
            const notes = savedData.notes || [];

            todoList.querySelectorAll('li').forEach((li, index) => {
                if (todoItems[index]) {
                    li.querySelector('.task-input').value = todoItems[index].task;
                    li.querySelector('#hoursInput').value = todoItems[index].hours;
                    li.querySelector('#minutesInput').value = todoItems[index].minutes;
                    li.querySelector('.task-checkbox').checked = todoItems[index].checked;
                    li.dataset.dateKey = todoItems[index].dateKey; // Set the date key for each task

                    // Disable input fields if the task is marked as completed
                    if (todoItems[index].checked) {
                        disableTaskInputFields(li);
                    }
                } else {
                    li.querySelector('.task-input').value = '';
                    li.querySelector('#hoursInput').value = '';
                    li.querySelector('#minutesInput').value = '';
                    li.querySelector('.task-checkbox').checked = false;
                    li.removeAttribute('data-date-key'); // Remove the date key if no data is present
                }
            });

            notesApp.querySelectorAll('input[type="text"]').forEach((input, index) => {
                input.value = notes[index] || '';
            });
        } else {
            // Clear inputs if no data is saved
            todoList.querySelectorAll('li').forEach(li => {
                li.querySelector('.task-input').value = '';
                li.querySelector('#hoursInput').value = '';
                li.querySelector('#minutesInput').value = '';
                li.querySelector('.task-checkbox').checked = false;
                li.removeAttribute('data-date-key'); // Remove the date key if no data is present
            });

            notesApp.querySelectorAll('input[type="text"]').forEach(input => {
                input.value = '';
            });
        }
    }

    // Save data whenever the input changes
    todoList.addEventListener('input', saveData);
    notesApp.addEventListener('input', saveData);

    updateCalendar();
});