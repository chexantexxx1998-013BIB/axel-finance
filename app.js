// AXEL Finance — Supabase connection
const SUPABASE_URL = "https://xshpmphihxjxxdfawjvo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4WmGJ8GMVatteNxdjghCfA_RPsBepMb";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);console.log("AXEL Supabase client:", supabaseClient ? "создан" : "не создан");

supabaseClient.auth.getSession().then(({ error }) => {
  if (error) {
    console.error("Supabase connection error:", error.message);
  } else {
    console.log("AXEL Supabase отвечает");
  }
});
const STORAGE_KEY = "myfinance.transactions.v1";
const CATEGORIES = ["Продукты","Жильё","Транспорт","Кафе и доставка","Здоровье","Покупки","Подписки","Переводы","Снятие наличных","Зарплата","Прочий доход","Другое"];
const $ = (id) => document.getElementById(id);
let transactions = loadTransactions();
let pendingImport = [];

const today = new Date();
$("monthFilter").value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
$("dateInput").value = localDateString(today);

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function loadTransactions() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter(x => x && x.id && Number.isFinite(Number(x.amount))) : [];
  } catch { return []; }
}
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function money(value) {
  return new Intl.NumberFormat("ru-RU", {maximumFractionDigits:0}).format(Math.round(value)) + " сум";
}
function monthMatches(date) {
  return String(date || "").slice(0,7) === $("monthFilter").value;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function inferCategory(description, type="expense") {
  const d = String(description || "").toLowerCase();
  if (type === "income") {
    if (/salary|зарплат|зп|ish haqi|maosh|оклад/.test(d)) return "Зарплата";
    return "Прочий доход";
  }
  if (/korzinka|makro|havas|магазин|продукт|supermarket|grocery|bread|non\b|market|magnum/.test(d)) return "Продукты";
  if (/аренд|квартир|коммунал|газоснаб|электроэнерг|water bill|rent|housing|kvartira/.test(d)) return "Жильё";
  if (/taxi|yandex go|uber|bus|metro|транспорт|такси|бензин|заправ|fuel|petrol/.test(d)) return "Транспорт";
  if (/cafe|coffee|restaurant|рестора|кафе|доставк|express24|evos|maxway|osh markazi|lavash/.test(d)) return "Кафе и доставка";
  if (/pharm|аптек|clinic|клиник|doctor|медицин|health/.test(d)) return "Здоровье";
  if (/netflix|spotify|youtube premium|subscription|подписк|icloud|google one/.test(d)) return "Подписки";
  if (/atm|cash withdrawal|снятие налич|банкомат/.test(d)) return "Снятие наличных";
  if (/transfer|перевод|перечислен|p2p/.test(d)) return "Переводы";
  return "Другое";
}
function render() {
  const monthTx = transactions.filter(t => monthMatches(t.date));
  // Переводы показываем в истории и учитываем в остатке, но не выдаём за доход или потребительские расходы.
  const incomes = monthTx.filter(t => t.type === "income" && t.category !== "Переводы").reduce((s,t)=>s+Number(t.amount),0);
  const expenses = monthTx.filter(t => t.type === "expense" && t.category !== "Переводы").reduce((s,t)=>s+Number(t.amount),0);
  const openingBalances = (typeof accounts !== "undefined" ? accounts : []).reduce((s,a)=>s+Number(a.balance),0);
  const allBalance = openingBalances + transactions.reduce((s,t)=>s+(t.type === "income" ? Number(t.amount) : -Number(t.amount)),0);
  $("balanceValue").textContent = money(allBalance);
  $("incomeValue").textContent = money(incomes);
  $("expenseValue").textContent = money(expenses);

  const totals = {};
  monthTx.filter(t=>t.type==="expense" && t.category !== "Переводы").forEach(t=>totals[t.category]=(totals[t.category]||0)+Number(t.amount));
  const sorted = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const catEl = $("categoryBreakdown");
  if (!sorted.length) catEl.innerHTML = '<div class="empty-state">Пока нет расходов за этот месяц.</div>';
  else {
    const max = sorted[0][1] || 1;
    catEl.innerHTML = sorted.map(([name,total])=>`<div class="category-row">
      <span class="category-name">${escapeHtml(name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,total/max*100)}%"></div></div>
      <span class="category-total">${money(total)}</span>
    </div>`).join("");
  }

  const query = $("searchInput").value.trim().toLowerCase();
  const filtered = monthTx.filter(t=>`${t.description} ${t.category}`.toLowerCase().includes(query))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || Number(b.createdAt)-Number(a.createdAt));
  $("transactionCount").textContent = `${filtered.length} ${plural(filtered.length, "операция", "операции", "операций")}`;
  $("transactionsBody").innerHTML = filtered.map(t=>`<tr>
    <td>${escapeHtml(t.date)}</td>
    <td>${escapeHtml(t.description)}</td>
    <td><span class="pill">${escapeHtml(t.category)}</span></td>
    <td>${escapeHtml(accountLabel(t.accountId))}</td>
    <td class="amount ${t.type}">${t.type==="income"?"+":"−"} ${money(Number(t.amount))}</td>
    <td><button class="edit-btn" data-edit="${escapeHtml(t.id)}" title="Изменить операцию">Изменить</button> <button class="delete-btn" data-delete="${escapeHtml(t.id)}" title="Удалить операцию" aria-label="Удалить операцию">×</button></td>
  </tr>`).join("");
  $("emptyTransactions").hidden = filtered.length > 0;
  if (typeof accounts !== "undefined") renderAccounts();
}
function plural(n, one, few, many) {
  const n10=n%10,n100=n%100;
  if(n10===1&&n100!==11)return one;
  if(n10>=2&&n10<=4&&(n100<12||n100>14))return few;
  return many;
}
function resetForm() {
  $("transactionForm").reset();
  $("dateInput").value = localDateString(new Date());
  $("formMessage").textContent = "";
}
$("transactionForm").addEventListener("submit", async event => {
  event.preventDefault();

  console.log("AXEL: новый обработчик сохранения запущен");

  const amount = Number($("amountInput").value);
  const description = $("descriptionInput").value.trim();
  const date = $("dateInput").value;
  const type = document.querySelector('input[name="type"]:checked').value;

  if (!Number.isFinite(amount) || amount <= 0 || !description || !date) {
    $("formMessage").textContent = "Проверь сумму, описание и дату.";
    return;
  }

  let category = $("categoryInput").value;
  const inferred = inferCategory(description, type);

  if (
    inferred !== "Другое" &&
    (category === "Другое" ||
      (type === "income" &&
        !["Зарплата", "Прочий доход"].includes(category)))
  ) {
    category = inferred;
  }

  if (
    type === "income" &&
    !["Зарплата", "Прочий доход"].includes(category)
  ) {
    category = inferred;
  }

  const accountId = $("transactionAccount").value || null;

  $("formMessage").textContent = "Сохраняем в облако…";

  try {
    const { data, error } = await supabaseClient
      .from("axel_transactions")
      .insert({
        account_id: accountId,
        transaction_date: date,
        description: description,
        amount: Math.round(amount),
        transaction_type: type,
        category: category
      })
      .select()
      .single();

    if (error) {
      console.error("AXEL INSERT ERROR:", error);
      $("formMessage").textContent =
        "Ошибка облака: " + error.message;
      return;
    }

    console.log("AXEL INSERT SUCCESS:", data);

    transactions.push({
      id: data.id,
      date: data.transaction_date,
      description: data.description,
      amount: Number(data.amount),
      type: data.transaction_type,
      category: data.category,
      accountId: data.account_id,
      importSource: data.import_source,
      importTime: data.import_time,
      createdAt: new Date(data.created_at).getTime()
    });

    saveTransactions();
    render();
    resetForm();

    $("formMessage").textContent = "Операция сохранена в облако.";
  } catch (error) {
    console.error("AXEL INSERT ERROR:", error);
    $("formMessage").textContent =
      "Ошибка сохранения: " + (error.message || "неизвестная ошибка");
  }
});
$("monthFilter").addEventListener("change", render);
$("searchInput").addEventListener("input", render);
$("addBtn").addEventListener("click", () => {$("descriptionInput").focus(); window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"});});

$("transactionsBody").addEventListener("click", async event => {
  const editBtn = event.target.closest("[data-edit]");

  if (editBtn) {
    const tx = transactions.find(t => t.id === editBtn.dataset.edit);
    if (!tx) return;

    document.querySelector(`input[name="editType"][value="${tx.type}"]`).checked = true;
    $("editAmount").value = tx.amount;
    $("editDescription").value = tx.description;
    $("editDate").value = tx.date;
    $("editCategory").value = tx.category;

    renderEditAccountOptions(tx.accountId || "");
    $("editForm").dataset.transactionId = tx.id;
    $("editDialog").showModal();
    return;
  }

  const btn = event.target.closest("[data-delete]");
  if (!btn) return;

  const tx = transactions.find(t => t.id === btn.dataset.delete);
  if (!tx || !confirm(`Удалить операцию «${tx.description}»?`)) return;

  try {
    const { error } = await supabaseClient
      .from("axel_transactions")
      .delete()
      .eq("id", tx.id);

    if (error) throw error;

    transactions = transactions.filter(t => t.id !== tx.id);
    saveTransactions();
    render();

    console.log("AXEL: операция удалена из облака", tx.id);
  } catch (error) {
    console.error("AXEL DELETE ERROR:", error);
    alert("Не удалось удалить операцию из облака: " + error.message);
  }
});


function renderEditAccountOptions(selectedId = "") {
  const select = $("editAccount");
  select.innerHTML = '<option value="">Не указан</option>' + accounts.map(a =>
    `<option value="${escapeHtml(a.id)}">${escapeHtml(a.bank)} · ${escapeHtml(a.name)}</option>`
  ).join("");
  select.value = accounts.some(a => a.id === selectedId) ? selectedId : "";
}

$("editCategory").innerHTML = CATEGORIES.map(c => `<option>${escapeHtml(c)}</option>`).join("");
function closeEditDialog() { $("editDialog").close(); }
$("closeEdit").addEventListener("click", closeEditDialog);
$("cancelEdit").addEventListener("click", closeEditDialog);
$("editForm").addEventListener("submit", async event => {
  event.preventDefault();

  const id = event.currentTarget.dataset.transactionId;
  const amount = Number($("editAmount").value);
  const description = $("editDescription").value.trim();
  const date = $("editDate").value;
  const type = document.querySelector('input[name="editType"]:checked').value;
  const category = $("editCategory").value;
  const accountId = $("editAccount").value || null;

  if (!Number.isFinite(amount) || amount <= 0 || !description || !date) {
    $("editMessage").textContent = "Проверь сумму, описание и дату.";
    return;
  }

  $("editMessage").textContent = "Сохраняем изменения в облако…";

  try {
    const { data, error } = await supabaseClient
      .from("axel_transactions")
      .update({
        account_id: accountId,
        transaction_date: date,
        description: description,
        amount: Math.round(amount),
        transaction_type: type,
        category: category
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const tx = transactions.find(t => t.id === id);

    if (tx) {
      tx.date = data.transaction_date;
      tx.description = data.description;
      tx.amount = Number(data.amount);
      tx.type = data.transaction_type;
      tx.category = data.category;
      tx.accountId = data.account_id;
      tx.importSource = data.import_source;
      tx.importTime = data.import_time;
      tx.createdAt = new Date(data.created_at).getTime();
    }

    saveTransactions();
    $("editDialog").close();
    render();

    console.log("AXEL: операция изменена в облаке", data);
  } catch (error) {
    console.error("AXEL UPDATE ERROR:", error);
    $("editMessage").textContent =
      "Ошибка сохранения: " + (error.message || "неизвестная ошибка");
  }
});

function download(name, content, type) {
  const blob = new Blob([content],{type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("exportBtn").addEventListener("click", () => {
  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    accounts,
    transactions
  };

  download(
    "myfinance-backup.json",
    JSON.stringify(backup, null, 2),
    "application/json;charset=utf-8"
  );
});

function parseCSV(text) {
  // Supports quoted cells, commas/semicolons, and Windows line endings.
  const firstLine = text.split(/\r?\n/).find(line=>line.trim()) || "";
  const delimiter = (firstLine.match(/;/g)||[]).length > (firstLine.match(/,/g)||[]).length ? ";" : ",";
  const rows=[]; let row=[], cell="", quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c === '"'){
      if(quoted && text[i+1] === '"'){cell+='"';i++;}
      else quoted=!quoted;
    } else if(c===delimiter && !quoted){row.push(cell);cell="";}
    else if((c==="\n"||c==="\r")&&!quoted){
      if(c==="\r"&&text[i+1]==="\n")i++;
      row.push(cell); if(row.some(v=>v.trim()!==""))rows.push(row);
      row=[];cell="";
    } else cell+=c;
  }
  if(cell.length||row.length){row.push(cell);if(row.some(v=>v.trim()!==""))rows.push(row);}
  return rows;
}
function normalizeHeader(v) {
  return String(v||"").replace(/^\uFEFF/,"").trim().toLowerCase().replace(/[\s_\-()[\]]/g,"");
}
function findColumn(headers, candidates) {
  return headers.findIndex(h=>candidates.includes(normalizeHeader(h)));
}
function parseDate(value) {
  const v=String(value||"").trim();
  if(/^\d{4}-\d{1,2}-\d{1,2}/.test(v)) return v.slice(0,10);
  let m=v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if(m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  const d=new Date(v);
  if(!Number.isNaN(d.getTime())) return localDateString(d);
  return "";
}
function parseAmount(value) {
  let s=String(value||"").trim().replace(/\s/g,"").replace(/[^\d,.-]/g,"");
  if(!s) return NaN;
  if(s.includes(",") && s.includes(".")){
    if(s.lastIndexOf(",")>s.lastIndexOf(".")) s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  } else if(s.includes(",")) {
    const parts=s.split(",");
    s=parts[parts.length-1].length===3 ? parts.join("") : s.replace(",",".");
  }
  return Number(s);
}
function normalizeImportedRows(rows) {
  if(rows.length<2) throw new Error("В файле нет строк с операциями.");
  const headers=rows[0].map(v=>String(v).trim());
  const dateIdx=findColumn(headers,["date","дата","transactiondate","operationdate","valuedate"]);
  const descIdx=findColumn(headers,["description","описание","merchant","торговаяточка","детали","назначениеплатежа","operation","операция","comment","комментарий","name"]);
  const amountIdx=findColumn(headers,["amount","сумма","transactionamount","суммаоперации"]);
  const debitIdx=findColumn(headers,["debit","расход","списание","withdrawal"]);
  const creditIdx=findColumn(headers,["credit","доход","зачисление","deposit"]);
  const typeIdx=findColumn(headers,["type","тип","direction","направление"]);
  const categoryIdx=findColumn(headers,["category","категория"]);
  if(dateIdx<0 || descIdx<0 || (amountIdx<0 && debitIdx<0 && creditIdx<0)) {
    throw new Error("Не удалось определить столбцы. Нужны дата, описание и сумма (или отдельные столбцы расход/доход).");
  }
  const out=[];
  for(const row of rows.slice(1)){
    const date=parseDate(row[dateIdx]); const description=String(row[descIdx]||"").trim();
    if(!date || !description) continue;
    let amount, type;
    if(debitIdx>=0 || creditIdx>=0){
      const debit=debitIdx>=0?Math.abs(parseAmount(row[debitIdx])):0;
      const credit=creditIdx>=0?Math.abs(parseAmount(row[creditIdx])):0;
      if(credit>0){amount=credit;type="income";}
      else if(debit>0){amount=debit;type="expense";}
      else continue;
    } else {
      const raw=parseAmount(row[amountIdx]); if(!Number.isFinite(raw)||raw===0)continue;
      const direction=String(typeIdx>=0?row[typeIdx]:"").toLowerCase();
      const isIncome=/income|credit|приход|зачислен|доход/.test(direction);
      type=(raw<0 ? "expense" : (isIncome ? "income" : "expense"));
      amount=Math.abs(raw);
    }
    const categoryRaw=categoryIdx>=0?String(row[categoryIdx]||"").trim():"";
    const category=CATEGORIES.find(c=>c.toLowerCase()===categoryRaw.toLowerCase()) || inferCategory(description,type);
    out.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),date,description,amount:Math.round(amount),type,category,createdAt:Date.now()});
  }
  if(!out.length) throw new Error("Не удалось распознать ни одной операции. Проверь формат дат и сумм.");
  return out;
}
function normalizePaymeRows(rows) {
  if (rows.length < 2) throw new Error("В Excel-файле нет строк с операциями.");
  const headers = rows[0].map(v => String(v ?? "").trim());
  const idx = name => headers.findIndex(h => normalizeHeader(h) === normalizeHeader(name));
  const dateIdx = idx("Дата платежа");
  const timeIdx = idx("Время платежа");
  const typeIdx = idx("Тип операции");
  const supplierIdx = idx("Имя поставщика");
  const orgIdx = idx("Название организации поставщика");
  const amountIdx = idx("Сумма платежа");
  const categoryIdx = idx("Категория");
  const statusIdx = idx("Состояние чека");
  if ([dateIdx, typeIdx, amountIdx].some(i => i < 0) || (supplierIdx < 0 && orgIdx < 0)) {
    throw new Error("Не удалось определить столбцы Payme. Нужны дата, тип операции, описание и сумма.");
  }
  const categoryMap = {
    "продукты": "Продукты",
    "общепит": "Кафе и доставка",
    "техника": "Покупки",
    "ком. услуги": "Жильё",
    "коммунальные услуги": "Жильё",
    "интернет": "Жильё",
    "перевод": "Переводы",
    "переводы": "Переводы",
    "транспорт": "Транспорт",
    "здоровье": "Здоровье",
    "развлечения": "Другое"
  };
  const out = [];
  for (const row of rows.slice(1)) {
    const status = statusIdx >= 0 ? String(row[statusIdx] ?? "").trim().toLowerCase() : "";
    if (status && !/оплачен|успеш|paid|success/.test(status)) continue;
    const date = parseDate(row[dateIdx]);
    const amount = Math.abs(parseAmount(row[amountIdx]));
    const operationType = String(row[typeIdx] ?? "").trim().toLowerCase();
    if (!date || !Number.isFinite(amount) || amount <= 0) continue;
    if (/поступлен|зачислен|приход|income/.test(operationType)) {
      var type = "income";
    } else if (/списан|расход|debit|withdrawal/.test(operationType)) {
      var type = "expense";
    } else {
      continue;
    }
    const supplier = String(supplierIdx >= 0 ? row[supplierIdx] ?? "" : "").trim();
    const org = String(orgIdx >= 0 ? row[orgIdx] ?? "" : "").trim();
    const description = supplier || org;
    if (!description) continue;
    const sourceCategory = String(categoryIdx >= 0 ? row[categoryIdx] ?? "" : "").trim().toLowerCase();
    let category = categoryMap[sourceCategory] || inferCategory(`${supplier} ${org}`, type);
    // Если описание надёжно указывает магазин/услугу, используем его для уточнения категории.
    const inferred = inferCategory(`${supplier} ${org}`, type);
    if (inferred !== "Другое" && (category === "Другое" || category === "Переводы")) {
      if (/korzinka|makro|havas|market/.test(`${supplier} ${org}`.toLowerCase())) category = "Продукты";
      else if (!/перевод|visa direct|multicard/.test(`${supplier} ${org}`.toLowerCase())) category = inferred;
    }
    const time = String(timeIdx >= 0 ? row[timeIdx] ?? "" : "").trim();
    out.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      date, description, amount: Math.round(amount), type, category,
      accountId: null, createdAt: Date.now(),
      importSource: "Payme", importTime: time
    });
  }
  if (!out.length) throw new Error("В выписке Payme не нашлось подходящих оплаченных операций.");
  return out;
}
$("csvFile").addEventListener("change", async event=>{
  const file=event.target.files[0]; if(!file)return;
  try {
    let rows;
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      if (!window.XLSX) throw new Error("Не удалось загрузить модуль чтения Excel. Проверь подключение к интернету и обнови страницу.");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {type:"array", cellDates:false});
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet, {header:1, defval:"", raw:false});
      const headers = (rows[0] || []).map(v => normalizeHeader(v));
      if (headers.includes(normalizeHeader("Дата платежа")) && headers.includes(normalizeHeader("Сумма платежа"))) {
        pendingImport = normalizePaymeRows(rows);
      } else {
        pendingImport = normalizeImportedRows(rows);
      }
    } else {
      const text=await file.text();
      if(text.includes("\u0000")) throw new Error("Похоже, это не CSV-файл. Сохрани выписку как CSV UTF-8.");
      rows=parseCSV(text);
      const headers = (rows[0] || []).map(v => normalizeHeader(v));
      pendingImport = headers.includes(normalizeHeader("Дата платежа")) && headers.includes(normalizeHeader("Сумма платежа"))
        ? normalizePaymeRows(rows) : normalizeImportedRows(rows);
    }
    $("importSummary").textContent=`Распознано операций: ${pendingImport.length}. Категории определены по данным Payme и правилам MyFinance. Проверь перед импортом.`;
    $("previewBody").innerHTML=pendingImport.slice(0,100).map(t=>`<tr><td>${escapeHtml(t.date)}</td><td>${escapeHtml(t.description)}</td><td><span class="pill">${escapeHtml(t.category)}</span></td><td>${t.type==="income"?"Доход":"Расход"}</td><td class="amount ${t.type}">${t.type==="income"?"+":"−"} ${money(t.amount)}</td></tr>`).join("");
    if(pendingImport.length>100) $("importSummary").textContent+=` Показаны первые 100 из ${pendingImport.length}.`;
    $("importDialog").showModal();
  } catch(error) {
    alert(error.message || "Не удалось прочитать выписку.");
  } finally {event.target.value="";}
});
$("cancelImport").addEventListener("click",()=>{$("importDialog").close();pendingImport=[];});
$("confirmImport").addEventListener("click",()=>{
  if(!pendingImport.length)return;
  // Skip likely duplicates based on date, description, amount and direction.
  const existing=new Set(transactions.map(t=>`${t.date}|${t.description.toLowerCase()}|${t.amount}|${t.type}`));
  let added=0;
  for(const t of pendingImport){
    const key=`${t.date}|${t.description.toLowerCase()}|${t.amount}|${t.type}`;
    if(existing.has(key))continue;
    transactions.push(t);existing.add(key);added++;
  }
  saveTransactions();render();$("importDialog").close();pendingImport=[];
  alert(`Импорт завершён. Добавлено операций: ${added}. Повторяющиеся записи пропущены.`);
});

// Accounts and opening balances are stored separately from transactions.
const ACCOUNT_KEY = "myfinance.accounts.v1";
let accounts = loadAccounts();

function loadAccounts() {
  try {
    const value = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "[]");
    return Array.isArray(value) ? value.filter(a => a && a.id && Number.isFinite(Number(a.balance))) : [];
  } catch { return []; }
}
function saveAccounts() { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts)); }
function accountLabel(accountId) {
  const account = accounts.find(a => a.id === accountId);
  return account ? `${account.bank} · ${account.name}` : "Не указан";
}
function accountCurrentBalance(account) {
  return Number(account.balance) + transactions
    .filter(t => t.accountId === account.id)
    .reduce((sum,t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
}
function renderAccountOptions() {
  const select = $("transactionAccount");
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '<option value="">Не указан</option>' + accounts.map(a =>
    `<option value="${escapeHtml(a.id)}">${escapeHtml(a.bank)} · ${escapeHtml(a.name)}</option>`
  ).join("");
  if (accounts.some(a => a.id === previous)) select.value = previous;
}
function renderAccounts() {
  const host = $("accountsList");
  if (!host) return;
  renderAccountOptions();
  $("accountEmpty").hidden = accounts.length > 0;
  host.innerHTML = accounts.map(a => `
    <div class="account-card">
      <div class="account-card-top">
        <div>
          <div class="account-bank-name">${escapeHtml(a.bank)}</div>
          <div class="account-subtitle">${escapeHtml(a.system)} · ${escapeHtml(a.name)}</div>
        </div>
        <button class="account-remove" data-remove-account="${escapeHtml(a.id)}" title="Удалить счёт" aria-label="Удалить счёт">×</button>
      </div>
      <div class="account-card-balance">${money(accountCurrentBalance(a))}</div>
      <div class="account-card-caption">Начальный остаток: ${money(Number(a.balance))}</div>
    </div>`).join("");

  const unassignedNet = transactions.filter(t => !t.accountId || !accounts.some(a => a.id === t.accountId))
    .reduce((sum,t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
  const unassigned = $("unassignedBalance");
  if (unassigned) {
    unassigned.hidden = !transactions.some(t => !t.accountId || !accounts.some(a => a.id === t.accountId));
    unassigned.textContent = `Операции без привязанного счёта: ${money(unassignedNet)}. Они включены в общий баланс.`;
  }
}
if ($("accountForm")) {
  
if ($("accountForm")) {
  $("accountForm").addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("accountName").value.trim();
    const balance = Number($("accountBalance").value);
    const bank = $("accountBank").value;
    const system = $("accountSystem").value;

    if (!name || !Number.isFinite(balance) || balance < 0) {
      alert("Проверь название счёта и начальный остаток.");
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from("axel_accounts")
        .insert({
          bank: bank,
          payment_system: system,
          name: name,
          opening_balance: Math.round(balance)
        })
        .select()
        .single();

      if (error) throw error;

      accounts.push({
        id: data.id,
        bank: data.bank,
        system: data.payment_system,
        name: data.name,
        balance: Number(data.opening_balance)
      });

      saveAccounts();
      renderAccounts();
      render();

      $("accountName").value = "";
      $("accountBalance").value = "0";

      console.log("AXEL: счёт сохранён в облаке", data);
      alert("Счёт успешно сохранён!");
    } catch (error) {
      console.error("AXEL ACCOUNT INSERT ERROR:", error);
      alert("Не удалось сохранить счёт: " + error.message);
    }
  });

  
$("accountsList").addEventListener("click", async event => {
  const btn = event.target.closest("[data-remove-account]");
  if (!btn) return;

  const account = accounts.find(a => a.id === btn.dataset.removeAccount);
  if (!account) return;

  if (!confirm(`Удалить счёт «${account.name}»? Операции останутся в истории, но потеряют привязку к этому счёту. Продолжить?`)) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("axel_accounts")
      .delete()
      .eq("id", account.id);

    if (error) throw error;

    accounts = accounts.filter(a => a.id !== account.id);

    // Обновляем локальные данные: операции остаются, но без привязки к счёту.
    transactions = transactions.map(t =>
      t.accountId === account.id
        ? { ...t, accountId: null }
        : t
    );

    saveAccounts();
    saveTransactions();
    renderAccounts();
    render();

    console.log("AXEL: счёт удалён из облака", account.id);
  } catch (error) {
    console.error("AXEL ACCOUNT DELETE ERROR:", error);
    alert("Не удалось удалить счёт: " + error.message);
  }
});


  renderAccounts();
}

 
  renderAccounts();
}
render();

const authPanel = document.getElementById("authPanel");
const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");
const signUpBtn = document.getElementById("signUpBtn");
const appContent = document.querySelector("main.container");

function showAuthState(session) {
  const signedIn = Boolean(session);
  authPanel.hidden = signedIn;
  appContent.hidden = !signedIn;
  const cloudButton = document.getElementById("cloudImportBtn");
if (cloudButton) cloudButton.hidden = !signedIn;

  const exportButton = document.getElementById("exportBtn");
  if (exportButton) exportButton.hidden = !signedIn;
}

showAuthState(null);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "Выполняется вход…";

  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    authMessage.textContent = "Не удалось войти. Проверь email и пароль.";
    console.error("AXEL sign-in error:", error.message);
    return;
  }

  showAuthState(data.session);
  authMessage.textContent = "";
});

signUpBtn.addEventListener("click", async () => {
  authMessage.textContent = "Создаём аккаунт…";

  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  if (!email || password.length < 10) {
    authMessage.textContent =
      "Введи email и пароль длиной не менее 10 символов.";
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    authMessage.textContent = "Не удалось создать аккаунт. Проверь данные.";
    console.error("AXEL sign-up error:", error.message);
    return;
  }

  if (data.session) {
    showAuthState(data.session);
    authMessage.textContent = "";
  } else {
    authMessage.textContent =
      "Проверь почту и подтверди регистрацию, затем войди.";
  }
});

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  showAuthState(session);

  if (!session) return;

  try {
    await loadCloudData();
  } catch (error) {
    console.error("AXEL: не удалось загрузить облачные данные:", error);
    alert("Не удалось загрузить данные из облака. Проверь подключение.");
  }
});
// AXEL Finance — безопасная проверка готовности облачного переноса
async function checkAxelCloudReady() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
    console.error("AXEL: пользователь не авторизован.");
    return false;
  }

  const { error: accountsError } = await supabaseClient
    .from("axel_accounts")
    .select("id")
    .limit(1);

  const { error: transactionsError } = await supabaseClient
    .from("axel_transactions")
    .select("id")
    .limit(1);

  if (accountsError || transactionsError) {
    console.error(
      "AXEL: не удалось проверить таблицы.",
      accountsError?.message || transactionsError?.message
    );
    return false;
  }

  console.log("AXEL: аккаунт авторизован, таблицы доступны.");
  return true;
}

checkAxelCloudReady();
// AXEL Finance — загрузка данных из Supabase
async function loadCloudData() {
  console.log("AXEL: начинаем загрузку данных из облака…");

  const { data: accountRows, error: accountsError } =
    await supabaseClient
      .from("axel_accounts")
      .select("*");

  if (accountsError) {
    console.error("AXEL: ошибка загрузки счетов:", accountsError.message);
    throw accountsError;
  }

  const { data: transactionRows, error: transactionsError } =
    await supabaseClient
      .from("axel_transactions")
      .select("*");

  if (transactionsError) {
    console.error("AXEL: ошибка загрузки операций:", transactionsError.message);
    throw transactionsError;
  }

  accounts = accountRows.map(a => ({
    id: a.id,
    bank: a.bank,
    system: a.payment_system,
    name: a.name,
    balance: Number(a.opening_balance)
  }));

  transactions = transactionRows.map(t => ({
    id: t.id,
    date: t.transaction_date,
    description: t.description,
    amount: Number(t.amount),
    type: t.transaction_type,
    category: t.category,
    accountId: t.account_id,
    importSource: t.import_source,
    importTime: t.import_time,
    createdAt: new Date(t.created_at).getTime()
  }));

  renderAccounts();
  render();

  console.log(
    `AXEL: загружено счетов: ${accounts.length}, операций: ${transactions.length}`
  );
}
const cloudImportBtn = document.getElementById("cloudImportBtn");

if (cloudImportBtn) {
  cloudImportBtn.addEventListener("click", async () => {
    const ready = await checkAxelCloudReady();

    if (!ready) {
      alert("Не удалось проверить подключение. Войди в аккаунт и попробуй снова.");
      return;
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      try {
        const backup = JSON.parse(await file.text());

        if (
          backup.version !== 2 ||
          !Array.isArray(backup.accounts) ||
          !Array.isArray(backup.transactions) ||
          backup.accounts.length !== 1 ||
          backup.transactions.length === 0
        ) {
          alert("Файл не подходит: ожидается резервная копия версии 2 с одним счётом и операциями.");
          return;
        }

        const account = backup.accounts[0];
        const confirmed = confirm(
          `Будет перенесён счёт ${account.bank} · ${account.name} ` +
          `и ${backup.transactions.length} операций в облако. ` +
          `Продолжить?`
        );

        if (!confirmed) return;

        cloudImportBtn.disabled = true;
        cloudImportBtn.textContent = "Переносим…";

        const { data, error } = await supabaseClient.rpc(
          "axel_import_backup",
          {
            p_account: account,
            p_transactions: backup.transactions
          }
        );

        if (error) {
          console.error("AXEL cloud import error:", error.message);
          alert("Перенос не выполнен: " + error.message);
          return;
        }

        alert(
          `Перенос завершён! Счет создан, операций перенесено: ` +
          `${data.transactions_imported}.`
        );
      } catch (error) {
        console.error("AXEL backup error:", error);
        alert("Не удалось прочитать резервную копию. Проверь файл и попробуй снова.");
      } finally {
        cloudImportBtn.disabled = false;
        cloudImportBtn.textContent = "☁ Перенести данные в облако";
      }
    });

    fileInput.click();
  });
}
