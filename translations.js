/**
 * 翻译字典 - 技能名称（含伤害类型）
 * 格式: "英文原名": { name: "中文翻译", type: "物理" | "魔法" | null }
 * type 可选值: "物理", "魔法", null（不标注）
 * 可自行添加或修改翻译
 */
const ABILITY_TRANSLATIONS = {

    "Attack": { name: "攻击", type: "物理" },
    "Auto-attack": { name: "普通攻击", type: "物理" },
    
};

/**
 * 翻译字典 - 敌人/NPC 名称
 * 格式: "英文原名": "中文翻译"
 * 可自行添加或修改翻译
 */
const ACTOR_TRANSLATIONS = {

    "Boss": "首领",
    "Howling Blade": "啸刃",
    

};

/**
 * 翻译函数
 * 优先使用 CSV 上传的翻译，如果没有则使用内置翻译
 */
function translateAbility(englishName) {
    // 优先使用 CSV 翻译
    if (window.csvAbilityTranslations && window.csvAbilityTranslations[englishName]) {
        return window.csvAbilityTranslations[englishName];
    }
    
    // 其次使用内置翻译
    const translation = ABILITY_TRANSLATIONS[englishName];
    if (translation) {
        // 新格式：返回对象
        if (typeof translation === 'object') {
            return translation;
        }
        // 兼容旧格式：直接是字符串
        return { name: translation, type: null };
    }
    return { name: englishName, type: null };
}

function translateActor(englishName) {
    // 优先使用 CSV 翻译
    if (window.csvActorTranslations && window.csvActorTranslations[englishName]) {
        return window.csvActorTranslations[englishName];
    }
    
    // 其次使用内置翻译
    return ACTOR_TRANSLATIONS[englishName] || englishName;
}