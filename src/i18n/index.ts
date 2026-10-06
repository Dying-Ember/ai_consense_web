import { createI18n } from 'vue-i18n'

export const SUPPORTED_LOCALES = ['zh-Hans', 'zh-Hant', 'en'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

const STORAGE_KEY = 'consense-language'

export const LOCALE_LABELS: Record<AppLocale, string> = {
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  en: 'English'
}

const zhHans = {
  app: { name: 'ConSense', tagline: 'CAC Solution · 本地部署' },
  nav: { drafting: 'Drafting 起草', vetting: 'Vetting 审查', advice: 'Advice 咨询', skills: 'Skills 配置', prompts: 'Prompts 提示词', collapse: '收起导航' },
  screen: {
    drafting: 'Drafting 起草',
    vetting: 'Vetting 审查',
    advice: 'Advice 咨询',
    prompts: 'Prompts 提示词'
  },
  topbar: {
    project: '项目', language: '语言', offline: '本地部署', scenario: '提案场景',
    newProject: '新建项目', renameProject: '重命名项目', deleteProject: '删除项目',
    projectName: '项目名称', projectContract: '合约编号', projectNamePlaceholder: '例如：示例房屋重建项目',
    createHint: '新建后自动切换到该项目；项目数据相互隔离，需在第 1 步重新上传标准模板与项目资料。',
    renameHint: '重命名只修改项目名称，不影响已上传的资料、变量与生成结果。',
    deleteGuard: '至少保留一个项目',
    deleteConfirm: '确认删除项目「@NAME@」？该操作不可恢复。',
    deleteHint: '将一并删除该项目的标准模板、证据、变量、生成文稿、审查问题与问答记录。',
    projectCreated: '项目已创建', projectDeleted: '项目已删除'
  },
  common: {
    save: '保存', cancel: '取消', close: '关闭', confirm: '确认', back: '上一步', next: '下一步',
    upload: '上传', download: '下载', search: '搜索', refresh: '刷新', delete: '删除', add: '新增',
    reset: '恢复默认', all: '全部', loading: '处理中…', done: '完成', empty: '暂无数据', confirmAll: '确认全部',
    status: '状态', type: '类型', scope: '范围', file: '文件', page: '页码', actions: '操作', detail: '详情',
    generated: '已生成', pending: '待生成', confirmed: '已确认', unconfirmed: '待确认', saved: '已保存',
    deleted: '已删除'
  },
  drafting: {
    title: '按标准模板与项目证据生成 NTT / SCT / SCC',
    subtitle: '先读取资料，再逐个确认变量，最后生成整份文稿。所有取值都必须有原文依据。',
    wizard: {
      inputs: { title: '1. 读取资料', desc: '标准模板与项目沟通证据', done: '资料已就绪' },
      base: { title: '2. 基础变量', desc: '全项目通用取值', done: '全部已确认' },
      files: { title: '3. 分文件变量', desc: '按 NTT / SCT / SCC 复核并生成', done: '已生成文稿' }
    },
    templates: { title: '1. 标准模板', desc: 'NTT / SCT / SCC 模板集，起草与变量推理的基准。', upload: '上传并解析', replace: '替换',
      blank: '下载空白模板草稿', blankHint: '下载带 {{key}} 占位符的 NTT 模板草稿，可在原 PDF 上加占位符后重新上传',
      blankDownloaded: '空白模板草稿已下载 — 按文件中的 {{key}} 占位符改写 NTT 后重新上传',
    },
    inputs: { title: '2. 项目沟通证据', desc: '邮件、会议纪要、备忘录与澄清记录，仅用于起草 NTT / SCT / SCC。', upload: '上传起草证据',
      deleteTitle: '删除证据', deleteConfirm: '确认删除「@NAME@」？该文件的分块与向量索引将一并移除，操作不可恢复。' },
    variables: {
      baseTitle: '基础变量', fileTitle: '分文件变量', extract: '识别变量', extracting: '本地模型正在识别变量…',
      source: '依据', affects: '影响文件', result: '处理方式', options: '选项', value: '取值', note: '模型依据',
      empty: '尚无变量，请先上传资料后点击「识别变量」，由本地模型自动识别变量并给出建议值。',
      emptyReady: '资料已就绪，点击上方「识别变量」，由本地模型自动识别变量并给出建议值。',
      extractHint: '变量识别不依赖预置清单：模型会通读已解析的模板与证据，自行识别需要决策的变量、取值与依据。',
      traceButton: '查看识别过程',
      traceTitle: '模型识别过程',
      traceModel: '模型',
      traceAt: '完成时间',
      traceSystem: '① 系统提示词（角色与规则）',
      traceUser: '② 发送给模型的材料（模板 + 项目证据）',
      traceRaw: '③ 模型原始返回（每个变量的取值、依据原文与思路）',
      traceEmpty: '尚未进行变量识别，先点击「识别变量」。',
      addVariable: '+ 新增变量',
      addVariableTitle: '新增 FILE 变量',
      addVariableHint: '模型未识别到的 Guidance Note / 编辑目标，可由 QS 手工补录。',
      addVariableKey: '变量 key（英文标识，仅字母数字下划线短横线）',
      addVariableFile: '作用文件',
      addVariableLabel: '标签',
      addVariableLabelZhHant: '繁體中文標籤（可選）',
      addVariableLabelEn: 'English label（可選）',
      addVariableAction: '处理方式',
      addVariableOptions: '选项（仅 choice 型需要，逗号或换行分隔）',
      addVariableAffects: '影响文件（NTT,SCT,SCC）',
      addVariableValue: '取值',
      addVariableSourceQuote: '原文依据片段',
      addVariableReason: '依据说明',
      addVariableConfidence: '置信度 0~1',
      addVariableSaved: '已新增变量',
      addVariableKeyInvalid: '仅允许英文 / 数字 / 下划线 / 短横线'
    },
    files: {
      tab: '文件', matrix: '变量影响关系图', generate: '一键生成文稿', generating: '正在生成文稿…',
      download: '下载模板', preview: '文稿预览',
      focusMode: '专注模式', exitFocus: '退出专注',
      confirmFileAll: '确认本文件全部变量',
      confirmFileDone: '@FILE@ 全部变量已确认',
      previewMode: '预览模式', modeReview: '审阅模式', modeFinal: '最终预览',
      downloadPdfHint: '下载生成稿 PDF；未生成时下载标准模板 PDF',
      downloadTemplateHint: '该文件尚未生成，将下载标准模板 PDF',
      varChecklist: '变量确认',
      headerTitle: '标准模板',
      reviewToggleHint: '打开 / 关闭本文件变量调整点抽屉',
      reviewToggle: '审阅调整点', reviewPaneTitle: '审阅区 · 调整点', reviewPaneHint: '默认列出本文件未确认的变量；点击任意条目会选中左侧对应变量卡并高亮闪烁，便于在 PDF 中定位该条款。', noPoints: '暂无调整点',
      valueLabel: '取值', resultLabel: '处理结果', sourceLabel: '来源', noteLabel: '模型依据',
      aiDraft: 'AI 建议稿', reedit: '重新编辑',
      impactPoint: '影响点', sharedWith: '同时影响',
      previewFailed: 'PDF 预览加载失败，请稍后重试。',
      pdfDiag: 'PDF 识别到 @TOKENS@ 个 {{KEY}}，其中 @MATCHED@ 个命中变量（共 @VARS@ 条）',
      ocrLoading: 'OCR 模型加载中（首次约 10MB）…',
      ocrRunning: 'OCR 识别中 @CURRENT@/@TOTAL@ 页…',
      ocrError: 'OCR 失败（PDF 仍可查看，token 高亮不可用）',
      listItems: '项', listHint: '清单型变量 — 请在第 2 步基础变量中逐行编辑。',
      noAnchor: '（未定位到模板锚点）',
      noLocatePoint: '未在模板中找到「@KEY@」的定位点：模板未包含 {{@KEY@}} 占位符，且该变量在模板中无对应条款文本',
      locateHint: '点击变量可定位到模板对应位置',
      matrixHint: '基础变量影响全部三份文件；FILE 变量按 fileKey 归属。点击单元格查看变量详情。',
      sankeySearch: '搜索变量名称 / key…',
      sankeyClear: '清除选择', sankeyFullscreen: '全屏',
      viewGraph: '图形视图', viewTable: '表格视图',
      sankeyVars: '变量', sankeyActions: '改写动作', sankeyFiles: '文件落点',
      sankeyEmpty: '暂无变量：先在第 1 步上传标准模板并抽取变量。',
      sankeyLegend: '变量 → 改写动作 → 文件落点；点击变量节点高亮链路，点击文件节点筛选落点，Esc 退出全屏。',
      sankeyGotoFile: '前往确认'
    },
    actions: {
      delete: '删除（含编号）', notused: 'Not used（保留编号）', choice: '二选一', rewrite: '整段重写', fill: '填空'
    },
    gates: {
      needInputs: '请先上传至少一份标准模板或项目证据。',
      needBase: '基础变量尚未全部确认，无法进入下一步。',
      needAll: '仍有变量未确认，请先确认全部变量。'
    }
  },
  vetting: {
    title: '审查整份招标文件，按问题类型输出可复核的审查报告',
    subtitle: '只审查本项目改动过的内容，每一处问题都附证据原文与处理建议。',
    metrics: {
      reference: '条款引用错误', referenceDetail: '引用不存在 / 编号错误 / 空白未定稿 / 版本引用',
      conflict: '内容冲突', conflictDetail: '范围 / 付款 / 工期 / 违约金 / 保函不一致',
      language: '语言与用词', languageDetail: '语法、拼写、英式 / 美式英语、表达不清',
      risk: '主观风险条款', riskDetail: '易引发合约争议 / 表述不清晰，需 QS 专业判断'
    },
    actions: {
      source: '审查源集', upload: '上传整份招标文件材料', run: '运行审查', running: '正在审查…', export: '导出审查报告（PDF）'
    },
    toolbar: { searchPlaceholder: '搜索条款、文件或问题', allTypes: '全部类型', allScopes: '全部范围', intra: '文件内', inter: '跨文件' },
    locator: { file: '1. 文件', page: '2. 页码', variable: '2. 变量', errorClass: '2. 错误类别', all: '全部' },
    list: { empty: '没有符合条件的审查发现。' },
    drawer: {
      title: '审查详情', subtitle: '证据、理由与人工处置。',
      type: '问题类型', scope: '范围', reference: '引用', status: '状态', pattern: '检测模式',
      location: '落点', expected: '应为', reason: '风险与理由', suggestion: '建议处理',
      openSource: '打开来源', markHandled: '标记已处理', assign: '分派给 QS',
      evidence: '证据原文', located: '已定位原文', unverified: '未能定位原文',
      locating: '正在回溯原文…',
      notLocated: '未能在该文件原文中逐字定位到这条内容，请人工复核。'
    },
    run: { empty: '尚未运行审查', started: '正在调用本地模型审查…', finished: '审查完成，共 {count} 条发现' }
  },
  advice: {
    title: '基于选定合约文件包进行提问',
    subtitle: '回答必须带合同条款或摘录；找不到依据时返回 I don\'t know，不补全。',
    scopeNote: '范围：整份招标文件；回答只引用包内条款，找不到依据时返回 I don\'t know',
    scope: { fullset: '选定合约条件', tender: '仅招标文件', contract: '仅合约条件' },
    actions: { refreshIndex: '刷新证据索引', ask: '提问', precedence: '优先次序依据', clear: '清空对话' },
    placeholder: '输入合约问题，例如：SCC4.1 下的文件优先次序是什么？',
    evidenceMode: '证据模式已开启',
    indexing: '正在重建证据索引…',
    chat: { title: '合约咨询对话', user: 'QS 用户', assistant: 'ConSense · 回答' },
    citation: {
      title: '引用文件内容', subtitle: '点击引用查看来源文件原文，命中段落高亮显示。',
      empty: '暂无引用，提问后展示来源原文。', emptySource: '右侧区域展示引用文件原文，并高亮命中段落。',
      footer: '证据模式已开启 · 不超出选定文件包进行推断。'
    },
    quick: '快速问题',
    unknown: {
      title: 'I don\'t know',
      fullset: '在选定范围（选定合约条件）内未找到充分条款依据。系统不会超出合约包进行推断。',
      tender: '在选定范围（仅招标文件）内未找到充分条款依据。系统不会超出合约包进行推断。',
      contract: '在选定范围（仅合约条件）内未找到充分条款依据。系统不会超出合约包进行推断。'
    },
    indexReady: '索引就绪，共 {count} 个切片'
  },
  skills: {
    title: 'Skills · 配置', edit: '编辑', preview: '预览', save: '保存修改', restore: '恢复默认',
    steps: 'How it decides', rules: 'Detection rules', output: '输出什么', guardrails: '不做什么（边界）',
    hint: '改动仅作用于此语言版本。'
  },
  system: {
    title: '本地依赖', llm: '大模型', ocr: 'OCR 解析', vector: '向量库',
    ready: '就绪', notReady: '未连接', healthy: '本地依赖就绪', degraded: '部分本地依赖未连接'
  },
  prompts: {
    title: '提示词配置',
    subtitle: '直接编辑驱动本地模型的提示词，保存后立即对后续调用生效，无需重新打包或重启服务。',
    systemLabel: 'System Prompt（角色与规则）',
    userLabel: 'User Prompt 模板',
    placeholders: '运行时占位符',
    customized: '已自定义',
    builtin: '出厂默认',
    save: '保存提示词',
    saving: '保存中…',
    saved: '提示词已保存',
    reset: '恢复出厂默认',
    resetDone: '已恢复出厂默认',
    reverting: '恢复中…',
    groupDrafting: 'Drafting 起草',
    groupVetting: 'Vetting 审查',
    groupAdvice: 'Advice 咨询',
    empty: '暂无提示词配置',
    pick: '从左侧选择一条提示词查看并编辑',
    placeholderHint: '这条 User 模板需要 {count} 个 %s 占位符，运行时按顺序填入项目数据；请勿增删或改动占位符数量。',
    noPlaceholderHint: '这条提示词没有运行时占位符，内容会原样送入模型。',
    updatedAt: '最近更新',
    unsaved: '有未保存的改动',
    unsavedConfirm: '当前有未保存的改动，切换后将被丢弃，确定继续？',
    resetConfirm: '确定恢复这条提示词的出厂默认内容？当前修改将丢失。'
  }
}

const zhHant: typeof zhHans = {
  app: { name: 'ConSense', tagline: 'CAC Solution · 本地部署' },
  nav: { drafting: 'Drafting 起草', vetting: 'Vetting 審查', advice: 'Advice 諮詢', skills: 'Skills 配置', prompts: 'Prompts 提示詞', collapse: '收起導航' },
  screen: { drafting: 'Drafting 起草', vetting: 'Vetting 審查', advice: 'Advice 諮詢', prompts: 'Prompts 提示詞' },
  topbar: {
    project: '項目', language: '語言', offline: '本地部署', scenario: '提案場景',
    newProject: '新增項目', renameProject: '重新命名項目', deleteProject: '刪除項目',
    projectName: '項目名稱', projectContract: '合約編號', projectNamePlaceholder: '例如：示例房屋重建項目',
    createHint: '新增後自動切換至該項目；項目資料相互隔離，需在第 1 步重新上傳標準模板與項目資料。',
    renameHint: '重新命名只修改項目名稱，不影響已上傳的資料、變量與生成結果。',
    deleteGuard: '至少保留一個項目',
    deleteConfirm: '確認刪除項目「@NAME@」？該操作不可復原。',
    deleteHint: '將一併刪除該項目的標準模板、證據、變量、生成文稿、審查問題與問答記錄。',
    projectCreated: '項目已建立', projectDeleted: '項目已刪除'
  },
  common: {
    save: '儲存', cancel: '取消', close: '關閉', confirm: '確認', back: '上一步', next: '下一步',
    upload: '上傳', download: '下載', search: '搜尋', refresh: '重新整理', delete: '刪除', add: '新增',
    reset: '恢復預設', all: '全部', loading: '處理中…', done: '完成', empty: '暫無資料', confirmAll: '確認全部',
    status: '狀態', type: '類型', scope: '範圍', file: '文件', page: '頁碼', actions: '操作', detail: '詳情',
    generated: '已生成', pending: '待生成', confirmed: '已確認', unconfirmed: '待確認', saved: '已儲存',
    deleted: '已刪除'
  },
  drafting: {
    title: '按標準模板與項目證據生成 NTT / SCT / SCC',
    subtitle: '先讀取資料，再逐個確認變量，最後生成整份文稿。所有取值都必須有原文依據。',
    wizard: {
      inputs: { title: '1. 讀取資料', desc: '標準模板與項目溝通證據', done: '資料已就緒' },
      base: { title: '2. 基礎變量', desc: '全項目通用取值', done: '全部已確認' },
      files: { title: '3. 分文件變量', desc: '按 NTT / SCT / SCC 覆核並生成', done: '已生成文稿' }
    },
    templates: { title: '1. 標準模板', desc: 'NTT / SCT / SCC 模板集，起草與變量推理的基準。', upload: '上傳並解析', replace: '替換',
      blank: '下載空白模板草稿', blankHint: '下載帶 {{key}} 佔位符的 NTT 模板草稿，可在原 PDF 上加佔位符後重新上傳',
      blankDownloaded: '空白模板草稿已下載 — 按文件中的 {{key}} 佔位符改寫 NTT 後重新上傳',
    },
    inputs: { title: '2. 項目溝通證據', desc: '郵件、會議紀要、備忘錄與澄清記錄，僅用於起草 NTT / SCT / SCC。', upload: '上傳起草證據',
      deleteTitle: '刪除證據', deleteConfirm: '確認刪除「@NAME@」？該文件的分塊與向量索引將一併移除，操作不可復原。' },
    variables: {
      baseTitle: '基礎變量', fileTitle: '分文件變量', extract: '識別變量', extracting: '本地模型正在識別變量…',
      source: '依據', affects: '影響文件', result: '處理方式', options: '選項', value: '取值', note: '模型依據',
      empty: '尚無變量，請先上傳資料後點擊「識別變量」，由本地模型自動識別變量並給出建議值。',
      emptyReady: '資料已就緒，點擊上方「識別變量」，由本地模型自動識別變量並給出建議值。',
      extractHint: '變量識別不依賴預置清單：模型會通讀已解析的模板與證據，自行識別需要決策的變量、取值與依據。',
      traceButton: '查看識別過程',
      traceTitle: '模型識別過程',
      traceModel: '模型',
      traceAt: '完成時間',
      traceSystem: '① 系統提示詞（角色與規則）',
      traceUser: '② 發送給模型的材料（模板 + 項目證據）',
      traceRaw: '③ 模型原始返回（每個變量的取值、依據原文與思路）',
      traceEmpty: '尚未進行變量識別，先點擊「識別變量」。',
      addVariable: '+ 新增變量',
      addVariableTitle: '新增 FILE 變量',
      addVariableHint: '模型未識別到的 Guidance Note / 編輯目標，可由 QS 手工補錄。',
      addVariableKey: '變量 key（英文標識，僅字母數字下劃線短橫線）',
      addVariableFile: '作用檔案',
      addVariableLabel: '標籤',
      addVariableLabelZhHant: '簡體中文標籤（可選）',
      addVariableLabelEn: 'English label（可選）',
      addVariableAction: '處理方式',
      addVariableOptions: '選項（僅 choice 型需要，逗號或換行分隔）',
      addVariableAffects: '影響檔案（NTT,SCT,SCC）',
      addVariableValue: '取值',
      addVariableSourceQuote: '原文依據片段',
      addVariableReason: '依據說明',
      addVariableConfidence: '置信度 0~1',
      addVariableSaved: '已新增變量',
      addVariableKeyInvalid: '僅允許英文 / 數字 / 下劃線 / 短橫線'
    },
    files: {
      tab: '文件', matrix: '變量影響關係圖', generate: '一鍵生成文稿', generating: '正在生成文稿…',
      download: '下載模板', preview: '文稿預覽',
      focusMode: '專注模式', exitFocus: '退出專注',
      confirmFileAll: '確認本文件全部變量',
      confirmFileDone: '@FILE@ 全部變量已確認',
      previewMode: '預覽模式', modeReview: '審閱模式', modeFinal: '最終預覽',
      downloadPdfHint: '下載生成稿 PDF；未生成時下載標準模板 PDF',
      downloadTemplateHint: '該文件尚未生成，將下載標準模板 PDF',
      varChecklist: '變量確認',
      headerTitle: '標準模板',
      reviewToggleHint: '打開 / 關閉本文件變量調整點抽屜',
      reviewToggle: '審閱調整點', reviewPaneTitle: '審閱區 · 調整點', reviewPaneHint: '預設列出本文件未確認的變量；點擊任意條目會選中左側對應變量卡並高亮閃爍，便於在 PDF 中定位該條款。', noPoints: '暫無調整點',
      valueLabel: '取值', resultLabel: '處理結果', sourceLabel: '來源', noteLabel: '模型依據',
      aiDraft: 'AI 建議稿', reedit: '重新編輯',
      impactPoint: '影響點', sharedWith: '同時影響',
      previewFailed: 'PDF 預覽載入失敗，請稍後重試。',
      pdfDiag: 'PDF 識別到 @TOKENS@ 個 {{KEY}}，其中 @MATCHED@ 個命中變量（共 @VARS@ 條）',
      ocrLoading: 'OCR 模型載入中（首次約 10MB）…',
      ocrRunning: 'OCR 識別中 @CURRENT@/@TOTAL@ 頁…',
      ocrError: 'OCR 失敗（PDF 仍可查看，token 高亮不可用）',
      listItems: '項', listHint: '清單型變量 — 請在第 2 步基礎變量中逐行編輯。',
      noAnchor: '（未定位到模板錨點）',
      noLocatePoint: '未在模板中找到「@KEY@」的定位點：模板未包含 {{@KEY@}} 佔位符，且該變量在模板中無對應條款文本',
      locateHint: '點擊變量可定位到模板對應位置',
      matrixHint: '基礎變量影響全部三份文件；FILE 變量按 fileKey 歸屬。點擊單元格查看變量詳情。',
      sankeySearch: '搜尋變量名稱 / key…',
      sankeyClear: '清除選擇', sankeyFullscreen: '全螢幕',
      viewGraph: '圖形視圖', viewTable: '表格視圖',
      sankeyVars: '變量', sankeyActions: '改寫動作', sankeyFiles: '文件落點',
      sankeyEmpty: '暫無變量：先在第 1 步上傳標準模板並抽取變量。',
      sankeyLegend: '變量 → 改寫動作 → 文件落點；點擊變量節點高亮鏈路，點擊文件節點篩選落點，Esc 退出全螢幕。',
      sankeyGotoFile: '前往確認'
    },
    actions: {
      delete: '刪除（含編號）', notused: 'Not used（保留編號）', choice: '二選一', rewrite: '整段重寫', fill: '填空'
    },
    gates: {
      needInputs: '請先上傳至少一份標準模板或項目證據。',
      needBase: '基礎變量尚未全部確認，無法進入下一步。',
      needAll: '仍有變量未確認，請先確認全部變量。'
    }
  },
  vetting: {
    title: '審查整份招標文件，按問題類型輸出可覆核的審查報告',
    subtitle: '只審查本項目改動過的內容，每一處問題都附證據原文與處理建議。',
    metrics: {
      reference: '條款引用錯誤', referenceDetail: '引用不存在 / 編號錯誤 / 空白未定稿 / 版本引用',
      conflict: '內容衝突', conflictDetail: '範圍 / 付款 / 工期 / 違約金 / 保函不一致',
      language: '語言與用詞', languageDetail: '語法、拼寫、英式 / 美式英語、表達不清',
      risk: '主觀風險條款', riskDetail: '易引發合約爭議 / 表述不清晰，需 QS 專業判斷'
    },
    actions: {
      source: '審查源集', upload: '上傳整份招標文件材料', run: '執行審查', running: '正在審查…', export: '匯出審查報告（PDF）'
    },
    toolbar: { searchPlaceholder: '搜尋條款、文件或問題', allTypes: '全部類型', allScopes: '全部範圍', intra: '文件內', inter: '跨文件' },
    locator: { file: '1. 文件', page: '2. 頁碼', variable: '2. 變量', errorClass: '2. 錯誤類別', all: '全部' },
    list: { empty: '沒有符合條件的審查發現。' },
    drawer: {
      title: '審查詳情', subtitle: '證據、理由與人工處置。',
      type: '問題類型', scope: '範圍', reference: '引用', status: '狀態', pattern: '檢測模式',
      location: '落點', expected: '應為', reason: '風險與理由', suggestion: '建議處理',
      openSource: '開啟來源', markHandled: '標記已處理', assign: '分派給 QS',
      evidence: '證據原文', located: '已定位原文', unverified: '未能定位原文',
      locating: '正在回溯原文…',
      notLocated: '未能在該文件原文中逐字定位到這條內容，請人工覆核。'
    },
    run: { empty: '尚未執行審查', started: '正在調用本地模型審查…', finished: '審查完成，共 {count} 條發現' }
  },
  advice: {
    title: '基於選定合約文件包進行提問',
    subtitle: '回答必須帶合約條款或摘錄；找不到依據時返回 I don\'t know，不補全。',
    scopeNote: '範圍：整份招標文件；回答只引用包內條款，找不到依據時返回 I don\'t know',
    scope: { fullset: '選定合約條件', tender: '僅招標文件', contract: '僅合約條件' },
    actions: { refreshIndex: '重新整理證據索引', ask: '提問', precedence: '優先次序依據', clear: '清空對話' },
    placeholder: '輸入合約問題，例如：SCC4.1 下的文件優先次序是什麼？',
    evidenceMode: '證據模式已開啟',
    indexing: '正在重建證據索引…',
    chat: { title: '合約諮詢對話', user: 'QS 用戶', assistant: 'ConSense · 回答' },
    citation: {
      title: '引用文件內容', subtitle: '點擊引用查看來源文件原文，命中段落高亮顯示。',
      empty: '暫無引用，提問後展示來源原文。', emptySource: '右側區域展示引用文件原文，並高亮命中段落。',
      footer: '證據模式已開啟 · 不超出選定文件包進行推斷。'
    },
    quick: '快速問題',
    unknown: {
      title: 'I don\'t know',
      fullset: '在選定範圍（選定合約條件）內未找到充分條款依據。系統不會超出合約包進行推斷。',
      tender: '在選定範圍（僅招標文件）內未找到充分條款依據。系統不會超出合約包進行推斷。',
      contract: '在選定範圍（僅合約條件）內未找到充分條款依據。系統不會超出合約包進行推斷。'
    },
    indexReady: '索引就緒，共 {count} 個切片'
  },
  skills: {
    title: 'Skills · 配置', edit: '編輯', preview: '預覽', save: '儲存修改', restore: '恢復預設',
    steps: 'How it decides', rules: 'Detection rules', output: '輸出什麼', guardrails: '不做什麼（邊界）',
    hint: '改動僅作用於此語言版本。'
  },
  system: {
    title: '本地依賴', llm: '大模型', ocr: 'OCR 解析', vector: '向量庫',
    ready: '就緒', notReady: '未連接', healthy: '本地依賴就緒', degraded: '部分本地依賴未連接'
  },
  prompts: {
    title: '提示詞配置',
    subtitle: '直接編輯驅動本地模型的提示詞，儲存後立即對後續調用生效，無需重新打包或重啟服務。',
    systemLabel: 'System Prompt（角色與規則）',
    userLabel: 'User Prompt 模板',
    placeholders: '執行時佔位符',
    customized: '已自訂',
    builtin: '出廠預設',
    save: '儲存提示詞',
    saving: '儲存中…',
    saved: '提示詞已儲存',
    reset: '恢復出廠預設',
    resetDone: '已恢復出廠預設',
    reverting: '恢復中…',
    groupDrafting: 'Drafting 起草',
    groupVetting: 'Vetting 審查',
    groupAdvice: 'Advice 諮詢',
    empty: '暫無提示詞配置',
    pick: '從左側選擇一條提示詞查看並編輯',
    placeholderHint: '這條 User 模板需要 {count} 個 %s 佔位符，執行時按順序填入項目資料；請勿增刪或改動佔位符數量。',
    noPlaceholderHint: '這條提示詞沒有執行時佔位符，內容會原樣送入模型。',
    updatedAt: '最近更新',
    unsaved: '有未儲存的改動',
    unsavedConfirm: '當前有未儲存的改動，切換後將被捨棄，確定繼續？',
    resetConfirm: '確定恢復這條提示詞的出廠預設內容？當前修改將遺失。'
  }
}

const en: typeof zhHans = {
  app: { name: 'ConSense', tagline: 'CAC Solution · on-premise' },
  nav: { drafting: 'Drafting', vetting: 'Vetting', advice: 'Advice', skills: 'Skills configuration', prompts: 'Prompts', collapse: 'Collapse' },
  screen: { drafting: 'Drafting', vetting: 'Vetting', advice: 'Advice', prompts: 'Prompts' },
  topbar: {
    project: 'Project', language: 'Language', offline: 'On-premise', scenario: 'Proposal scenario',
    newProject: 'New project', renameProject: 'Rename project', deleteProject: 'Delete project',
    projectName: 'Project name', projectContract: 'Contract no.', projectNamePlaceholder: 'e.g. Sample Housing Redevelopment',
    createHint: 'Switches to the new project automatically. Project data is isolated — upload standard templates and project evidence again in step 1.',
    renameHint: 'Renaming only changes the project name; uploaded evidence, variables and generated documents are unaffected.',
    deleteGuard: 'At least one project must remain',
    deleteConfirm: 'Delete project "@NAME@"? This cannot be undone.',
    deleteHint: 'Its templates, evidence, variables, generated documents, vetting findings and chat history will be removed as well.',
    projectCreated: 'Project created', projectDeleted: 'Project deleted'
  },
  common: {
    save: 'Save', cancel: 'Cancel', close: 'Close', confirm: 'Confirm', back: 'Back', next: 'Next',
    upload: 'Upload', download: 'Download', search: 'Search', refresh: 'Refresh', delete: 'Delete', add: 'Add',
    reset: 'Restore defaults', all: 'All', loading: 'Working…', done: 'Done', empty: 'No data yet', confirmAll: 'Confirm all',
    status: 'Status', type: 'Type', scope: 'Scope', file: 'File', page: 'Page', actions: 'Actions', detail: 'Detail',
    generated: 'Generated', pending: 'Draft pending', confirmed: 'Confirmed', unconfirmed: 'Pending', saved: 'Saved',
    deleted: 'Deleted'
  },
  drafting: {
    title: 'Draft NTT / SCT / SCC from standard templates and project evidence',
    subtitle: 'Read the sources, confirm every variable, then generate the documents. Every value must trace back to source text.',
    wizard: {
      inputs: { title: '1. Read the sources', desc: 'Standard templates and project evidence', done: 'Sources ready' },
      base: { title: '2. Base variables', desc: 'Package-wide values', done: 'All confirmed' },
      files: { title: '3. Per-file variables', desc: 'Review by NTT / SCT / SCC and generate', done: 'Documents generated' }
    },
    templates: { title: '1. Standard templates', desc: 'NTT / SCT / SCC template set used for drafting output.', upload: 'Upload and parse', replace: 'Replace',
      blank: 'Download blank template draft', blankHint: 'Download an NTT draft with {{key}} placeholders to edit and re-upload',
      blankDownloaded: 'Blank template draft downloaded — rewrite NTT with the listed {{key}} placeholders and re-upload',
    },
    inputs: { title: '2. Project communication evidence', desc: 'Email, meeting minutes, memo and clarification records used only to draft NTT / SCT / SCC.', upload: 'Upload drafting evidence',
      deleteTitle: 'Delete evidence', deleteConfirm: 'Delete “@NAME@”? Its parsed chunks and vector index will be removed as well. This cannot be undone.' },
    variables: {
      baseTitle: 'Base variables', fileTitle: 'Per-file variables', extract: 'Discover variables', extracting: 'Local model is discovering variables…',
      source: 'Basis', affects: 'Affects', result: 'How it is handled', options: 'Options', value: 'Value', note: 'Model basis',
      empty: 'No variables yet — upload sources and click “Discover variables”: the local model identifies variables, values and evidence on its own.',
      emptyReady: 'Sources are ready — click “Discover variables” above and the local model will identify variables, values and evidence on its own.',
      extractHint: 'Discovery relies on no predefined list: the model reads the parsed templates and evidence, and identifies the decision variables, values and quotes itself.',
      traceButton: 'View AI process',
      traceTitle: 'Model extraction trace',
      traceModel: 'Model',
      traceAt: 'Finished at',
      traceSystem: '① System prompt (role and rules)',
      traceUser: '② Materials sent to the model (templates + project evidence)',
      traceRaw: '③ Raw model output (value, source quote and reasoning per variable)',
      traceEmpty: 'No extraction yet — click "Extract variables" first.',
      addVariable: '+ Add variable',
      addVariableTitle: 'Add FILE variable',
      addVariableHint: 'For Guidance Notes / edit points the model missed — QS can fill in manually.',
      addVariableKey: 'Variable key (English identifier, letters/digits/_/- only)',
      addVariableFile: 'Target file',
      addVariableLabel: 'Label',
      addVariableLabelZhHant: 'Traditional Chinese label (optional)',
      addVariableLabelEn: 'English label (optional)',
      addVariableAction: 'Action',
      addVariableOptions: 'Options (choice only; comma or newline separated)',
      addVariableAffects: 'Affects files (NTT,SCT,SCC)',
      addVariableValue: 'Value',
      addVariableSourceQuote: 'Source quote',
      addVariableReason: 'Reason',
      addVariableConfidence: 'Confidence 0~1',
      addVariableSaved: 'Variable added',
      addVariableKeyInvalid: 'Only letters, digits, underscore and hyphen are allowed'
    },
    files: {
      tab: 'Files', matrix: 'Variable impact graph', generate: 'Generate all documents', generating: 'Generating documents…',
      download: 'Download template', preview: 'Preview',
      focusMode: 'Focus mode', exitFocus: 'Exit focus',
      confirmFileAll: 'Confirm all variables in this file',
      confirmFileDone: 'All variables of @FILE@ confirmed',
      previewMode: 'Preview mode', modeReview: 'Review mode', modeFinal: 'Final preview',
      downloadPdfHint: 'Download the generated document as PDF; falls back to the standard template PDF before generation',
      downloadTemplateHint: 'This document is not generated yet — the standard template PDF will be downloaded',
      varChecklist: 'variable confirmation',
      headerTitle: 'Standard template',
      reviewToggleHint: 'Open / close the adjustment points drawer for this file',
      reviewToggle: 'Adjustment points', reviewPaneTitle: 'Review pane · adjustment points', reviewPaneHint: 'Lists unconfirmed variables in this file by default. Click any item to highlight the matching variable card on the left and briefly flash it, helping you locate the clause in the PDF.', noPoints: 'No adjustment points yet',
      valueLabel: 'Value', resultLabel: 'Result', sourceLabel: 'Source', noteLabel: 'Model basis',
      aiDraft: 'AI draft', reedit: 'Edit again',
      impactPoint: 'Impact point', sharedWith: 'Shared with',
      previewFailed: 'Failed to load the PDF preview. Please retry.',
      pdfDiag: 'PDF detected @TOKENS@ {{KEY}} placeholders, @MATCHED@ matched variables (@VARS@ total)',
      ocrLoading: 'OCR model loading (~10MB on first run)…',
      ocrRunning: 'OCR @CURRENT@/@TOTAL@ pages…',
      ocrError: 'OCR failed (PDF still viewable; token highlight unavailable)',
      listItems: 'items', listHint: 'List variable — edit the rows in step 2 (base variables).',
      noAnchor: '(no template anchor located)',
      noLocatePoint: 'No anchor found for "@KEY@" in the template: the template has no {{@KEY@}} placeholder and no matching clause text',
      locateHint: 'Click a variable to jump to its position in the template',
      matrixHint: 'Base variables affect all three files; FILE variables belong to their fileKey. Click a cell for details.',
      sankeySearch: 'Search variable name / key…',
      sankeyClear: 'Clear selection', sankeyFullscreen: 'Fullscreen',
      viewGraph: 'Graph view', viewTable: 'Table view',
      sankeyVars: 'Variables', sankeyActions: 'Rewrite actions', sankeyFiles: 'File targets',
      sankeyEmpty: 'No variables yet — upload standard templates in step 1 and extract variables first.',
      sankeyLegend: 'Variables → rewrite actions → file targets. Click a variable node to trace its links, click a file node to filter targets, Esc exits fullscreen.',
      sankeyGotoFile: 'Go to confirmation'
    },
    actions: {
      delete: 'Delete (with clause number)', notused: 'Not used (keep clause number)', choice: 'Keep one alternative', rewrite: 'Rewrite whole paragraph', fill: 'Fill value'
    },
    gates: {
      needInputs: 'Upload at least one standard template or piece of evidence first.',
      needBase: 'Base variables are not all confirmed yet.',
      needAll: 'Some variables are still unconfirmed — confirm all of them first.'
    }
  },
  vetting: {
    title: 'Vet the assembled tender package and report reviewable findings by type',
    subtitle: 'Only content changed for this project is vetted; every finding carries source evidence and a suggested action.',
    metrics: {
      reference: 'Clause reference error', referenceDetail: 'Missing / wrong number / blank placeholder / version reference',
      conflict: 'Content conflict', conflictDetail: 'Scope / payment / programme / liquidated damages / security mismatch',
      language: 'Language and wording', languageDetail: 'Grammar, spelling, British vs American English, ambiguity',
      risk: 'Subjective risk clause', riskDetail: 'Dispute-prone or unclear wording — requires QS judgement'
    },
    actions: {
      source: 'Review source set', upload: 'Upload tender package', run: 'Run vetting', running: 'Vetting…', export: 'Export report (PDF)'
    },
    toolbar: { searchPlaceholder: 'Search clause, document or issue', allTypes: 'All types', allScopes: 'All scopes', intra: 'Intra-file', inter: 'Cross-file' },
    locator: { file: '1. File', page: '2. Page', variable: '2. Variable', errorClass: '2. Error class', all: 'All' },
    list: { empty: 'No findings match the current filters.' },
    drawer: {
      title: 'Finding detail', subtitle: 'Evidence, reason and human disposition.',
      type: 'Type', scope: 'Scope', reference: 'Reference', status: 'Status', pattern: 'Detection pattern',
      location: 'Location', expected: 'Expected basis', reason: 'Reason', suggestion: 'Suggested action',
      openSource: 'Open source', markHandled: 'Mark handled', assign: 'Assign to QS',
      evidence: 'Source evidence', located: 'Located in source', unverified: 'Not located in source',
      locating: 'Tracing back to the source…',
      notLocated: 'This content could not be located verbatim in the source file — please review this finding manually.'
    },
    run: { empty: 'Vetting has not been run yet', started: 'Running the local model…', finished: 'Vetting completed with {count} findings' }
  },
  advice: {
    title: 'Ask questions against the selected contract package',
    subtitle: 'Answers must carry a clause or excerpt; when no basis is found the system returns I don\'t know.',
    scopeNote: 'Scope: the complete tender document package; answers cite in-package clauses only.',
    scope: { fullset: 'Selected package conditions', tender: 'Tender documents only', contract: 'Conditions of Contract only' },
    actions: { refreshIndex: 'Refresh evidence index', ask: 'Ask', precedence: 'Precedence basis', clear: 'Clear chat' },
    placeholder: 'Ask a contract question, e.g. What is the order of precedence under SCC4.1?',
    evidenceMode: 'Evidence mode on',
    indexing: 'Rebuilding the evidence index…',
    chat: { title: 'Contract advice chat', user: 'QS user', assistant: 'ConSense · Answer' },
    citation: {
      title: 'Cited document content', subtitle: 'Click a citation to view the source text with the matched passage highlighted.',
      empty: 'No citations yet — ask a question to see the source text.', emptySource: 'The source text appears here with the matched passage highlighted.',
      footer: 'Evidence mode on · no inference beyond the selected package.'
    },
    quick: 'Quick questions',
    unknown: {
      title: 'I don\'t know',
      fullset: 'No sufficient provision was found in the selected scope (selected package conditions). The system will not infer beyond the contract package.',
      tender: 'No sufficient provision was found in the selected scope (tender documents only). The system will not infer beyond the contract package.',
      contract: 'No sufficient provision was found in the selected scope (conditions of contract only). The system will not infer beyond the contract package.'
    },
    indexReady: '{count} chunks indexed and ready'
  },
  skills: {
    title: 'Skills · configuration', edit: 'Edit', preview: 'Preview', save: 'Save changes', restore: 'Restore defaults',
    steps: 'How it decides', rules: 'Detection rules', output: 'Output', guardrails: 'Guardrails',
    hint: 'Changes apply to this language version only.'
  },
  system: {
    title: 'Local dependencies', llm: 'Language model', ocr: 'OCR', vector: 'Vector store',
    ready: 'Ready', notReady: 'Not connected', healthy: 'Local dependencies ready', degraded: 'Some local dependencies are not connected'
  },
  prompts: {
    title: 'Prompt configuration',
    subtitle: 'Edit the prompts that drive the local model. Changes apply to the very next model call — no repackage or restart needed.',
    systemLabel: 'System prompt (role and rules)',
    userLabel: 'User prompt template',
    placeholders: 'Runtime placeholders',
    customized: 'Customised',
    builtin: 'Factory default',
    save: 'Save prompt',
    saving: 'Saving…',
    saved: 'Prompt saved',
    reset: 'Restore factory default',
    resetDone: 'Factory default restored',
    reverting: 'Restoring…',
    groupDrafting: 'Drafting',
    groupVetting: 'Vetting',
    groupAdvice: 'Advice',
    empty: 'No prompt configuration yet',
    pick: 'Pick a prompt on the left to view and edit it',
    placeholderHint: 'This user template needs {count} %s placeholder(s); project data is injected in order at runtime — keep the placeholder count unchanged.',
    noPlaceholderHint: 'This prompt has no runtime placeholder; the text is sent to the model as-is.',
    updatedAt: 'Last updated',
    unsaved: 'Unsaved changes',
    unsavedConfirm: 'You have unsaved changes. Switching will discard them. Continue?',
    resetConfirm: 'Restore the factory default for this prompt? Your current edits will be lost.'
  }
}

function resolveInitialLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
    return stored as AppLocale
  }
  return 'zh-Hans'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: 'zh-Hans',
  messages: { 'zh-Hans': zhHans, 'zh-Hant': zhHant, en }
})

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

export function currentLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale
}
