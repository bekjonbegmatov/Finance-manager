/**
 * Модуль управления финансовыми транзакциями
 */

// Немедленно вызываемая функция для изоляции кода
(function($) {
    'use strict';

    // Ключи для хранения данных в localStorage
    const STORAGE_KEY = 'financeData';
    const THEME_KEY = 'theme';
    const CATEGORIES_KEY = 'categories';

    // Базовые категории
    let incomeCategories = JSON.parse(localStorage.getItem('incomeCategories') || JSON.stringify([
        'Зарплата', 'Инвестиции', 'Фриланс', 'Другое'
    ]));
    
    let expenseCategories = JSON.parse(localStorage.getItem('expenseCategories') || JSON.stringify([
        'Продукты', 'Транспорт', 'Развлечения', 'Коммунальные услуги', 'Другое'
    ]));

    // Демо-данные для первого запуска
    const demoData = [
        { date: '2024-01-15', category: 'Зарплата', description: 'Зарплата за январь', amount: 150000 },
        { date: '2024-01-16', category: 'Продукты', description: 'Продукты в магазине', amount: -5000 },
        { date: '2024-01-17', category: 'Транспорт', description: 'Проездной', amount: -2000 }
    ];

    // Состояние приложения
    let transactions = [];
    let charts = {
        balance: null,
        category: null
    };

    /**
     * Загрузка данных из localStorage
     */
    function loadData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        transactions = stored ? JSON.parse(stored) : demoData;
        renderTable();
        updateCharts();
        updateBalance();
    }

    /**
     * Сохранение данных в localStorage
     */
    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }

    /**
     * Форматирование суммы в рубли
     */
    function formatAmount(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    }

    /**
     * Обновление общего баланса
     */
    function updateBalance() {
        const total = transactions.reduce((sum, t) => sum + t.amount, 0);
        const $balance = $('#totalBalance');
        $balance.text(formatAmount(total));
        $balance.removeClass('text-green-600 text-red-600 dark:text-green-400 dark:text-red-400')
            .addClass(total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400');
    }

    // Текущие фильтры
    let currentFilters = {
        type: 'all',
        sortOrder: 'date-desc',
        category: 'all'
    };

    // Обработчики изменения фильтров
    $('#filterType').on('change', function() {
        currentFilters.type = $(this).val();
        renderTable();
        updateCharts();
    });

    $('#filterCategory').on('change', function() {
        currentFilters.category = $(this).val();
        renderTable();
        updateCharts();
    });

    $('#filterSort').on('change', function() {
        currentFilters.sortOrder = $(this).val();
        renderTable();
    });

    /**
     * Обновление списка категорий в фильтре
     */
    function updateCategoryFilter() {
        const $filterCategory = $('#filterCategory');
        $filterCategory.empty().append('<option value="all">Все категории</option>');
        
        const allCategories = [...new Set([...incomeCategories, ...expenseCategories])];
        allCategories.forEach(category => {
            $filterCategory.append(`<option value="${category}">${category}</option>`);
        });
    }

    /**
     * Отрисовка таблицы транзакций
     */
    function renderTable() {
        const $list = $('#transactionsList');
        $list.empty();

        // Применяем фильтры
        let filteredTransactions = transactions.filter(t => {
            if (currentFilters.type === 'income' && t.amount < 0) return false;
            if (currentFilters.type === 'expense' && t.amount > 0) return false;
            if (currentFilters.category !== 'all' && t.category !== currentFilters.category) return false;
            return true;
        });

        // Применяем сортировку
        filteredTransactions.sort((a, b) => {
            switch (currentFilters.sortOrder) {
                case 'date-asc':
                    return new Date(a.date) - new Date(b.date);
                case 'date-desc':
                    return new Date(b.date) - new Date(a.date);
                case 'amount-asc':
                    return a.amount - b.amount;
                case 'amount-desc':
                    return b.amount - a.amount;
                default:
                    return new Date(b.date) - new Date(a.date);
            }
        });

        filteredTransactions.forEach((transaction, index) => {
                const row = $('<tr>').addClass('transaction-row')
                    .append(
                        $('<td>').addClass('px-6 py-4').text(new Date(transaction.date).toLocaleDateString('ru-RU')),
                        $('<td>').addClass('px-6 py-4').text(transaction.category),
                        $('<td>').addClass('px-6 py-4').text(transaction.description),
                        $('<td>').addClass('px-6 py-4 ' + (transaction.amount >= 0 ? 'amount-positive' : 'amount-negative'))
                            .text(formatAmount(transaction.amount)),
                        $('<td>').addClass('px-6 py-4')
                            .append(
                                $('<button>').addClass('action-button mr-2').html('<i class="fas fa-edit"></i>')
                                    .on('click', () => editTransaction(index)),
                                $('<button>').addClass('action-button').html('<i class="fas fa-trash"></i>')
                                    .on('click', () => deleteTransaction(index))
                            )
                    );
                $list.append(row);
            });
    }

    /**
     * Обновление графиков
     */
    function updateCharts() {
        // График баланса
        const balanceCtx = document.getElementById('balanceChart').getContext('2d');
        if (charts.balance) charts.balance.destroy();

        // Фильтруем транзакции в соответствии с текущими фильтрами
        let filteredTransactions = transactions.filter(t => {
            if (currentFilters.type === 'income' && t.amount < 0) return false;
            if (currentFilters.type === 'expense' && t.amount > 0) return false;
            if (currentFilters.category !== 'all' && t.category !== currentFilters.category) return false;
            return true;
        });

        const balanceData = filteredTransactions.reduce((acc, t) => {
            const date = t.date;
            acc[date] = (acc[date] || 0) + t.amount;
            return acc;
        }, {});

        charts.balance = new Chart(balanceCtx, {
            type: 'line',
            data: {
                labels: Object.keys(balanceData).sort(),
                datasets: [{
                    label: 'Баланс',
                    data: Object.values(balanceData),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#3B82F6',
                    pointHoverBackgroundColor: '#3B82F6',
                    pointHoverBorderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: document.body.classList.contains('dark') ? '#fff' : '#000'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Баланс: ' + formatAmount(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: value => formatAmount(value),
                            color: document.body.classList.contains('dark') ? '#fff' : '#000'
                        }
                    },
                    x: {
                        ticks: {
                            color: document.body.classList.contains('dark') ? '#fff' : '#000'
                        }
                    }
                }
            }
        });

        // График категорий
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        if (charts.category) charts.category.destroy();

        const categoryData = filteredTransactions
            .filter(t => currentFilters.type === 'all' ? t.amount < 0 : currentFilters.type === 'expense')
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
                return acc;
            }, {});

        charts.category = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categoryData),
                datasets: [{
                    data: Object.values(categoryData),
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(139, 92, 246, 0.8)'
                    ],
                    borderColor: '#fff',
                    borderWidth: 2,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: document.body.classList.contains('dark') ? '#fff' : '#000',
                            generateLabels: function(chart) {
                                const data = chart.data;
                                const total = data.datasets[0].data.reduce((sum, value) => sum + value, 0);
                                return data.labels.map((label, i) => ({
                                    text: `${label} (${formatAmount(data.datasets[0].data[i])}, ${Math.round(data.datasets[0].data[i] / total * 100)}%)`,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    hidden: false,
                                    index: i
                                }));
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
                                const percentage = Math.round(context.raw / total * 100);
                                return `${context.label}: ${formatAmount(context.raw)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Добавление нового дохода
     */
    function addIncome(event) {
        event.preventDefault();

        const transaction = {
            date: $('#incomeDate').val(),
            category: $('#incomeCategory').val(),
            description: $('#incomeDescription').val(),
            amount: Math.abs(parseFloat($('#incomeAmount').val()))
        };

        if (!transaction.date || !transaction.category || !transaction.description || transaction.amount === 0) {
            alert('Пожалуйста, заполните все поля корректно');
            return;
        }

        transactions.push(transaction);
        saveData();
        renderTable();
        updateCharts();
        updateBalance();

        // Очистка формы
        event.target.reset();
    }

    /**
     * Добавление нового расхода
     */
    function addExpense(event) {
        event.preventDefault();

        const transaction = {
            date: $('#expenseDate').val(),
            category: $('#expenseCategory').val(),
            description: $('#expenseDescription').val(),
            amount: -Math.abs(parseFloat($('#expenseAmount').val()))
        };

        if (!transaction.date || !transaction.category || !transaction.description || transaction.amount === 0) {
            alert('Пожалуйста, заполните все поля корректно');
            return;
        }

        transactions.push(transaction);
        saveData();
        renderTable();
        updateCharts();
        updateBalance();

        // Очистка формы
        event.target.reset();
    }

    /**
     * Редактирование транзакции
     */
    function editTransaction(index) {
        const transaction = transactions[index];
        $('#editIndex').val(index);
        $('#editDate').val(transaction.date);
        $('#editDescription').val(transaction.description);
        $('#editAmount').val(Math.abs(transaction.amount));

        // Заполняем список категорий в зависимости от типа транзакции
        const $editCategory = $('#editCategory').empty();
        const categories = transaction.amount >= 0 ? incomeCategories : expenseCategories;
        categories.forEach(category => {
            $editCategory.append(`<option value="${category}"${category === transaction.category ? ' selected' : ''}>${category}</option>`);
        });

        // Показываем модальное окно
        $('#editModal').removeClass('hidden').addClass('flex');
    }

    // Обработчик закрытия модального окна редактирования
    $('#closeEditModal').on('click', function() {
        $('#editModal').removeClass('flex').addClass('hidden');
    });

    // Обработчик формы редактирования
    $('#editForm').on('submit', function(event) {
        event.preventDefault();
        
        const index = parseInt($('#editIndex').val());
        const editedTransaction = {
            date: $('#editDate').val(),
            category: $('#editCategory').val(),
            description: $('#editDescription').val(),
            amount: parseFloat($('#editAmount').val())
        };

        // Сохраняем знак суммы (доход/расход) от исходной транзакции
        if (transactions[index].amount < 0) {
            editedTransaction.amount = -Math.abs(editedTransaction.amount);
        }

        // Обновляем транзакцию
        transactions[index] = editedTransaction;
        saveData();
        renderTable();
        updateCharts();
        updateBalance();

        // Закрываем модальное окно
        $('#editModal').removeClass('flex').addClass('hidden');
    });

    /**
     * Удаление транзакции
     */
    function deleteTransaction(index) {
        if (confirm('Вы уверены, что хотите удалить эту транзакцию?')) {
            transactions.splice(index, 1);
            saveData();
            renderTable();
            updateCharts();
            updateBalance();
        }
    }

    /**
     * Экспорт в CSV
     */
    function exportToCsv() {
        const csvContent = 'data:text/csv;charset=utf-8,'
            + 'Дата,Категория,Описание,Сумма\n'
            + transactions.map(t => [
                t.date,
                t.category,
                `"${t.description}"`,
                t.amount
            ].join(',')).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'finance_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Импорт из CSV
     */
    function importFromCsv(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                const rows = text.split('\n').slice(1); // Пропускаем заголовок
                const newTransactions = rows
                    .filter(row => row.trim())
                    .map(row => {
                        const [date, category, description, amount] = row.split(',');
                        return {
                            date,
                            category,
                            description: description.replace(/"/g, ''),
                            amount: parseFloat(amount)
                        };
                    });

                transactions = newTransactions;
                saveData();
                renderTable();
                updateCharts();
                updateBalance();
            };
            reader.readAsText(file);
        }
    }

    /**
     * Переключение темы
     */
    function toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        document.body.classList.toggle('dark');
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        updateCharts(); // Обновляем цвета графиков
        updateCategorySelects(); // Обновляем стили селектов
        renderTable(); // Обновляем стили таблицы
    }

    // Инициализация темы
    function initTheme() {
        const theme = localStorage.getItem(THEME_KEY);
        if (theme === 'dark') {
            document.body.classList.add('dark');
        }
    }

    // Инициализация приложения
    $(document).ready(function() {
        const isDark = localStorage.getItem(THEME_KEY) === 'dark';
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark');
        }
        loadData();

        // Управление модальным окном категорий
        $('#manageCategories').on('click', function() {
            $('#categoryModal').removeClass('hidden').addClass('flex');
            renderCategories();
        });

        $('#closeModal').on('click', function() {
            $('#categoryModal').removeClass('flex').addClass('hidden');
        });

        $('#addCategory').on('click', function() {
            const newCategory = $('#newCategory').val().trim();
            const type = $('#categoryType').val();
            
            if (!newCategory) {
                alert('Введите название категории');
                return;
            }

            const categories = type === 'income' ? incomeCategories : expenseCategories;
            if (categories.includes(newCategory)) {
                alert('Такая категория уже существует');
                return;
            }

            if (type === 'income') {
                incomeCategories.push(newCategory);
                localStorage.setItem('incomeCategories', JSON.stringify(incomeCategories));
            } else {
                expenseCategories.push(newCategory);
                localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories));
            }

            renderCategories();
            updateCategorySelects();
            $('#newCategory').val('');
        });

        function renderCategories() {
            const $list = $('#categoriesList').empty();
            
            // Добавляем заголовок для категорий доходов
            $list.append($('<h4>').addClass('text-lg font-semibold mb-2 dark:text-white').text('Категории доходов'));
            
            // Рендерим категории доходов
            incomeCategories.forEach((category, index) => {
                const $item = createCategoryItem(category, index, true);
                $list.append($item);
            });

            // Добавляем разделитель
            $list.append($('<hr>').addClass('my-4 border-gray-200 dark:border-gray-600'));

            // Добавляем заголовок для категорий расходов
            $list.append($('<h4>').addClass('text-lg font-semibold mb-2 dark:text-white').text('Категории расходов'));

            // Рендерим категории расходов
            expenseCategories.forEach((category, index) => {
                const $item = createCategoryItem(category, index, false);
                $list.append($item);
            });
        }

        function createCategoryItem(category, index, isIncome) {
            return $('<div>').addClass('flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-md animate-scale mb-2')
                .append(
                    $('<span>').addClass('dark:text-white').text(category),
                    $('<button>').addClass('text-red-500 hover:text-red-700')
                        .html('<i class="fas fa-trash"></i>')
                        .on('click', () => {
                            const transactions = isIncome ? 
                                window.transactions.filter(t => t.amount > 0) : 
                                window.transactions.filter(t => t.amount < 0);

                            if (transactions.some(t => t.category === category)) {
                                alert('Нельзя удалить категорию, которая используется в транзакциях');
                                return;
                            }

                            if (isIncome) {
                                incomeCategories.splice(index, 1);
                                localStorage.setItem('incomeCategories', JSON.stringify(incomeCategories));
                            } else {
                                expenseCategories.splice(index, 1);
                                localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories));
                            }

                            renderCategories();
                            updateCategorySelects();
                        })
                );
        }

        function updateCategorySelects() {
            // Обновляем селект для доходов
            const $incomeSelect = $('#incomeCategory');
            $incomeSelect.empty();
            incomeCategories.forEach(category => {
                $incomeSelect.append($('<option>').val(category).text(category));
            });

            // Обновляем селект для расходов
            const $expenseSelect = $('#expenseCategory');
            $expenseSelect.empty();
            expenseCategories.forEach(category => {
                $expenseSelect.append($('<option>').val(category).text(category));
            });
        }

        // Привязка обработчиков событий
        $('#incomeForm').on('submit', addIncome);
        $('#expenseForm').on('submit', addExpense);
        $('#themeToggle').on('click', function() {
            const isDark = !document.documentElement.classList.contains('dark');
            document.documentElement.classList.toggle('dark');
            document.body.classList.toggle('dark');
            localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
            updateCharts();
        });

        // Обработчики фильтров
        $('#filterType, #sortOrder, #filterCategory').on('change', function() {
            currentFilters.type = $('#filterType').val();
            currentFilters.sortOrder = $('#sortOrder').val();
            currentFilters.category = $('#filterCategory').val();
            renderTable();
        });

        $('#exportCsv').on('click', exportToCsv);
        $('#importCsv').on('change', importFromCsv);
    });

})(jQuery);