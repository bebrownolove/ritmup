import Foundation
import HealthKit

struct HealthSnapshot: Encodable {
    let date: String
    let activeCalories: Int
    let steps: Int
    let exerciseMinutes: Int
    let weightKg: Double?
}

enum RitmHealthError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Apple Health недоступен на этом устройстве"
        }
    }
}

final class HealthKitManager {
    private let store = HKHealthStore()
    private let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!
    private let stepCount = HKObjectType.quantityType(forIdentifier: .stepCount)!
    private let exerciseTime = HKObjectType.quantityType(forIdentifier: .appleExerciseTime)!
    private let bodyMass = HKObjectType.quantityType(forIdentifier: .bodyMass)!

    func todaySnapshot() async throws -> HealthSnapshot {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw RitmHealthError.unavailable
        }

        let readTypes: Set<HKObjectType> = [activeEnergy, stepCount, exerciseTime, bodyMass]
        try await store.requestAuthorization(toShare: Set<HKSampleType>(), read: readTypes)

        let now = Date()
        let start = Calendar.current.startOfDay(for: now)
        async let calories = cumulativeSum(type: activeEnergy, unit: .kilocalorie(), start: start, end: now)
        async let steps = cumulativeSum(type: stepCount, unit: .count(), start: start, end: now)
        async let exercise = cumulativeSum(type: exerciseTime, unit: .minute(), start: start, end: now)
        async let weight = latestWeight(before: now)

        return try await HealthSnapshot(
            date: Self.localDate(now),
            activeCalories: max(0, Int(calories.rounded())),
            steps: max(0, Int(steps.rounded())),
            exerciseMinutes: max(0, Int(exercise.rounded())),
            weightKg: weight
        )
    }

    private func cumulativeSum(type: HKQuantityType, unit: HKUnit, start: Date, end: Date) async throws -> Double {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [.strictStartDate])
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: result?.sumQuantity()?.doubleValue(for: unit) ?? 0)
            }
            store.execute(query)
        }
    }

    private func latestWeight(before end: Date) async throws -> Double? {
        let predicate = HKQuery.predicateForSamples(withStart: nil, end: end, options: [.strictEndDate])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: bodyMass, predicate: predicate, limit: 1, sortDescriptors: [sort]) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let value = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: .gramUnit(with: .kilo))
                continuation.resume(returning: value)
            }
            store.execute(query)
        }
    }

    private static func localDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
