// BLACKGYM CRASH DIAGNOSTICS — std::terminate handler (installed before main).
// See plugins/withCrashDiagnostics.js for the rationale.

#import <Foundation/Foundation.h>

#include <cstdlib>
#include <exception>

static std::terminate_handler g_previousTerminateHandler = nullptr;

static void BlackGymWriteReport(NSString *report) {
  NSLog(@"%@", report);

  NSArray<NSString *> *caches =
      NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
  NSString *path = [caches.firstObject stringByAppendingPathComponent:@"blackgym_last_crash.txt"];
  [report writeToFile:path atomically:YES encoding:NSUTF8StringEncoding error:NULL];

  // The file is the reliable channel: the pasteboard needs an XPC round-trip
  // that does not complete before abort(), so it is intentionally skipped
  // here. The report is surfaced by CrashDiagnostics.presentPendingReport()
  // on the next launch, while the app is fully alive.
}

static NSString *BlackGymDescribeActiveException(std::exception_ptr eptr) {
  try {
    std::rethrow_exception(eptr);
  } catch (const std::exception &e) {
    NSString *what = [NSString stringWithUTF8String:e.what()];
    if (!what) {
      what = @"(unreadable what())";
    }
    NSString *stack = [[NSThread callStackSymbols] componentsJoinedByString:@"\n"];
    return [NSString stringWithFormat:@"C++ std::exception\nwhat(): %@\nstack:\n%@", what, stack];
  } catch (...) {
    return @"C++ exception of unknown type";
  }
  return nil; // Unreachable — keeps -Werror=return-type quiet.
}

static void BlackGymTerminateHandler(void) {
  NSMutableString *report =
      [NSMutableString stringWithString:@"[Black Gym] std::terminate — uncaught exception\n"];

  std::exception_ptr eptr = std::current_exception();
  if (eptr) {
    [report appendFormat:@"%@\n", BlackGymDescribeActiveException(eptr)];
  } else {
    [report appendString:@"(no active exception)\n"];
  }

  BlackGymWriteReport(report);

  if (g_previousTerminateHandler) {
    g_previousTerminateHandler();
  } else {
    abort();
  }
}

__attribute__((constructor)) static void BlackGymInstallTerminateHandler(void) {
  g_previousTerminateHandler = std::set_terminate(&BlackGymTerminateHandler);
}
